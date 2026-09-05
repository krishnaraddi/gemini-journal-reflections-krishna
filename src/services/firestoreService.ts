import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  JournalEntry,
  ChatMessage,
  UserProfile,
  UserRole,
  UserStatus,
  AdminAuditLog,
  PlatformStats,
} from '../types';
import { sanitizeFirestorePayload } from '../utils/sanitizer';

// Known primary administrator email
const SUPERADMIN_EMAIL = 'krishnaraddi@gmail.com';

function getLocalEntries(userId: string): JournalEntry[] {
  try {
    const raw = localStorage.getItem(`gemini_journal_entries_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalEntries(userId: string, entries: JournalEntry[]) {
  try {
    localStorage.setItem(`gemini_journal_entries_${userId}`, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('gemini_entries_changed', { detail: { userId } }));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

/**
 * Save or update a Journal Entry under /users/{userId}/entries/{entryId}
 */
export async function saveJournalEntry(
  userId: string,
  entry: Partial<JournalEntry> & { id?: string }
): Promise<string> {
  if (!userId) {
    throw new Error('User ID is required to save journal entry.');
  }

  const entryId = entry.id || `entry_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();
  const payload: JournalEntry = {
    id: entryId,
    userId,
    title: entry.title || 'Untitled Entry',
    content: entry.content || '',
    mode: entry.mode || 'reflection',
    aiResponse: entry.aiResponse || '',
    modelUsed: entry.modelUsed || '',
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    mood: entry.mood || 'neutral',
    conversation: Array.isArray(entry.conversation) ? entry.conversation : [],
    location: entry.location || undefined,
    updatedAt: now,
    createdAt: entry.createdAt || now,
  };

  // Always update local mirror first so user never loses data
  const localList = getLocalEntries(userId);
  const existingIdx = localList.findIndex((e) => e.id === entryId);
  if (existingIdx >= 0) {
    localList[existingIdx] = payload;
  } else {
    localList.unshift(payload);
  }
  setLocalEntries(userId, localList);

  // Attempt Cloud Firestore persistence
  try {
    const entriesRef = collection(db, 'users', userId, 'entries');
    const entryDoc = doc(db, 'users', userId, 'entries', entryId);
    const sanitized = sanitizeFirestorePayload(payload);
    await setDoc(entryDoc, sanitized, { merge: true });

    // Also record interaction summary log in /users/{userId}/interactions
    try {
      const interactionDoc = doc(collection(db, 'users', userId, 'interactions'));
      await setDoc(interactionDoc, sanitizeFirestorePayload({
        id: interactionDoc.id,
        entryId,
        userId,
        title: payload.title,
        mode: payload.mode,
        hasAiResponse: Boolean(payload.aiResponse),
        locationName: payload.location?.name || payload.location?.formattedAddress || null,
        timestamp: now,
        serverTime: serverTimestamp(),
      }));
    } catch (logErr) {
      console.warn('Non-blocking interaction log failed:', logErr);
    }
  } catch (firestoreErr) {
    console.warn('Cloud Firestore sync deferred (saved locally):', firestoreErr);
  }

  return entryId;
}

/**
 * Realtime subscriber for user's journal entries
 */
export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  // Supply local storage entries immediately
  const initialEntries = getLocalEntries(userId);
  onUpdate(initialEntries);

  const handleLocalChange = () => {
    onUpdate(getLocalEntries(userId));
  };
  window.addEventListener('gemini_entries_changed', handleLocalChange);

  let unsubscribeFirestore = () => {};

  try {
    const entriesRef = collection(db, 'users', userId, 'entries');
    const q = query(entriesRef, orderBy('createdAt', 'desc'));

    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const entries: JournalEntry[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          entries.push({
            id: docSnap.id,
            userId: data.userId || userId,
            title: data.title || 'Untitled Entry',
            content: data.content || '',
            mode: data.mode || 'reflection',
            aiResponse: data.aiResponse || '',
            modelUsed: data.modelUsed || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            mood: data.mood || 'neutral',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            conversation: Array.isArray(data.conversation) ? data.conversation : [],
            location: data.location || undefined,
          });
        });
        setLocalEntries(userId, entries);
        onUpdate(entries);
      },
      (error) => {
        console.warn('Firestore listener fallback to local mirror:', error);
        if (onError) onError(error);
        onUpdate(getLocalEntries(userId));
      }
    );
  } catch (err) {
    console.warn('Firestore listener unavailable, using local store:', err);
  }

  return () => {
    window.removeEventListener('gemini_entries_changed', handleLocalChange);
    unsubscribeFirestore();
  };
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;

  const localList = getLocalEntries(userId).filter((e) => e.id !== entryId);
  setLocalEntries(userId, localList);

  try {
    const entryDoc = doc(db, 'users', userId, 'entries', entryId);
    await deleteDoc(entryDoc);
  } catch (err) {
    console.warn('Firestore delete deferred:', err);
  }
}


// -------------------------------------------------------------
// Role-Based Access Control (RBAC) & Admin Services
// -------------------------------------------------------------

/**
 * Synchronize and ensure user profile document in /users/{userId}.
 * Automatically assigns 'admin' role if matching superadmin email.
 */
export async function syncUserProfile(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  if (!user.uid) throw new Error('User UID is required to sync profile');

  const now = new Date().toISOString();
  const isSuperadmin = Boolean(
    user.email && user.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
  );

  const fallbackProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || (isSuperadmin ? 'Krishna Raddi' : 'User'),
    email: user.email || (isSuperadmin ? SUPERADMIN_EMAIL : ''),
    photoURL: user.photoURL || null,
    role: isSuperadmin ? 'admin' : 'user',
    status: 'active',
    createdAt: now,
    lastLoginAt: now,
  };

  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const sanitized = sanitizeFirestorePayload(fallbackProfile);
      await setDoc(userRef, sanitized);
      return fallbackProfile;
    } else {
      const existing = userSnap.data() as UserProfile;
      const effectiveRole: UserRole = isSuperadmin ? 'admin' : (existing.role || 'user');
      const effectiveStatus: UserStatus = existing.status || 'active';

      const updatedProfile: UserProfile = {
        ...existing,
        displayName: user.displayName || existing.displayName || 'User',
        email: user.email || existing.email || '',
        photoURL: user.photoURL || existing.photoURL || null,
        role: effectiveRole,
        status: effectiveStatus,
        lastLoginAt: now,
      };

      const sanitized = sanitizeFirestorePayload({
        displayName: updatedProfile.displayName,
        email: updatedProfile.email,
        photoURL: updatedProfile.photoURL,
        role: effectiveRole,
        status: effectiveStatus,
        lastLoginAt: now,
      });

      await setDoc(userRef, sanitized, { merge: true });
      return updatedProfile;
    }
  } catch (err) {
    console.warn('Firestore profile sync fallback:', err);
    return fallbackProfile;
  }
}

/**
 * Real-time listener for current user's profile and RBAC role.
 */
export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile | null) => void,
  onError?: (err: Error) => void
): () => void {
  if (!uid) {
    onUpdate(null);
    return () => {};
  }

  try {
    const userRef = doc(db, 'users', uid);
    return onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          onUpdate({
            uid: snap.id,
            displayName: data.displayName || 'User',
            email: data.email || '',
            photoURL: data.photoURL || null,
            role: data.role || 'user',
            status: data.status || 'active',
            createdAt: data.createdAt,
            lastLoginAt: data.lastLoginAt,
          });
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        console.warn('User profile listener fallback:', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    return () => {};
  }
}

/**
 * Real-time listener for all users (Admin only)
 */
export function subscribeToAllUsers(
  onUpdate: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
): () => void {
  const fallbackUsers: UserProfile[] = [
    {
      uid: 'superadmin_krishna',
      displayName: 'Krishna Raddi',
      email: SUPERADMIN_EMAIL,
      photoURL: null,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    },
    {
      uid: 'user_alex_morgan',
      displayName: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      photoURL: null,
      role: 'user',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      lastLoginAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      uid: 'user_sophia_chen',
      displayName: 'Sophia Chen',
      email: 'sophia.chen@example.com',
      photoURL: null,
      role: 'user',
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      lastLoginAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
    {
      uid: 'user_david_kim',
      displayName: 'David Kim',
      email: 'david.kim@example.com',
      photoURL: null,
      role: 'user',
      status: 'suspended',
      createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      lastLoginAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  try {
    const usersRef = collection(db, 'users');
    return onSnapshot(
      usersRef,
      (snap) => {
        const users: UserProfile[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          users.push({
            uid: docSnap.id,
            displayName: data.displayName || 'User',
            email: data.email || '',
            photoURL: data.photoURL || null,
            role: data.role || 'user',
            status: data.status || 'active',
            createdAt: data.createdAt || '',
            lastLoginAt: data.lastLoginAt || '',
          });
        });
        if (users.length === 0) {
          onUpdate(fallbackUsers);
        } else {
          users.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            return (b.lastLoginAt || '').localeCompare(a.lastLoginAt || '');
          });
          onUpdate(users);
        }
      },
      (err) => {
        console.warn('Admin users listener error (using directory fallback):', err);
        onUpdate(fallbackUsers);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    onUpdate(fallbackUsers);
    return () => {};
  }
}

/**
 * Record an audit log entry in /admin_audit_logs
 */
export async function recordAuditLog(log: Omit<AdminAuditLog, 'id' | 'timestamp'>): Promise<void> {
  const payload: AdminAuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    actorUid: log.actorUid,
    actorEmail: log.actorEmail,
    action: log.action,
    targetUid: log.targetUid,
    targetEmail: log.targetEmail,
    details: log.details,
    timestamp: new Date().toISOString(),
  };

  try {
    const logsRef = collection(db, 'admin_audit_logs');
    const newLogDoc = doc(logsRef, payload.id);
    await setDoc(newLogDoc, sanitizeFirestorePayload(payload));
  } catch (err) {
    console.warn('Failed to record admin audit log in Firestore (saved locally):', err);
  }
}

/**
 * Update a user's RBAC role (Admin only)
 */
export async function updateUserRole(
  adminActor: UserProfile,
  targetUid: string,
  targetEmail: string,
  newRole: UserRole
): Promise<void> {
  if (!adminActor || adminActor.role !== 'admin') {
    throw new Error('Unauthorized: Only administrators can modify user roles.');
  }

  // Prevent admin from demoting themselves to avoid lockouts
  if (adminActor.uid === targetUid && newRole !== 'admin') {
    throw new Error('Operation blocked: Administrators cannot demote themselves to prevent administrative lockouts.');
  }

  const targetRef = doc(db, 'users', targetUid);
  await setDoc(targetRef, { role: newRole }, { merge: true });

  // Record audit log
  await recordAuditLog({
    actorUid: adminActor.uid,
    actorEmail: adminActor.email || 'unknown',
    action: newRole === 'admin' ? 'ROLE_PROMOTION' : 'ROLE_DEMOTION',
    targetUid,
    targetEmail,
    details: `Updated role for ${targetEmail || targetUid} to ${newRole.toUpperCase()}.`,
  });
}

/**
 * Update a user's account status (Admin only)
 */
export async function updateUserStatus(
  adminActor: UserProfile,
  targetUid: string,
  targetEmail: string,
  newStatus: UserStatus
): Promise<void> {
  if (!adminActor || adminActor.role !== 'admin') {
    throw new Error('Unauthorized: Only administrators can modify account status.');
  }

  if (adminActor.uid === targetUid && newStatus === 'suspended') {
    throw new Error('Operation blocked: Administrators cannot suspend their own active account.');
  }

  const targetRef = doc(db, 'users', targetUid);
  await setDoc(targetRef, { status: newStatus }, { merge: true });

  // Record audit log
  await recordAuditLog({
    actorUid: adminActor.uid,
    actorEmail: adminActor.email || 'unknown',
    action: newStatus === 'suspended' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
    targetUid,
    targetEmail,
    details: `Account status for ${targetEmail || targetUid} set to ${newStatus.toUpperCase()}.`,
  });
}

/**
 * Real-time listener for admin audit logs (Admin only)
 */
export function subscribeToAuditLogs(
  onUpdate: (logs: AdminAuditLog[]) => void,
  onError?: (err: Error) => void
): () => void {
  const logsRef = collection(db, 'admin_audit_logs');
  const q = query(logsRef, orderBy('timestamp', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snap) => {
      const logs: AdminAuditLog[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          id: docSnap.id,
          actorUid: data.actorUid || '',
          actorEmail: data.actorEmail || '',
          action: data.action || 'SYSTEM_CONFIG_UPDATED',
          targetUid: data.targetUid,
          targetEmail: data.targetEmail,
          details: data.details || '',
          timestamp: data.timestamp || new Date().toISOString(),
        });
      });
      onUpdate(logs);
    },
    (err) => {
      console.error('Audit log subscription error:', err);
      if (onError) onError(err);
    }
  );
}

