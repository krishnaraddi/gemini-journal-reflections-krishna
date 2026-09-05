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

  const entriesRef = collection(db, 'users', userId, 'entries');
  const entryId = entry.id || doc(entriesRef).id;
  const entryDoc = doc(db, 'users', userId, 'entries', entryId);

  const now = new Date().toISOString();
  const payload: Partial<JournalEntry> = {
    id: entryId,
    userId,
    title: entry.title || 'Untitled Entry',
    content: entry.content || '',
    mode: entry.mode || 'reflection',
    aiResponse: entry.aiResponse || '',
    modelUsed: entry.modelUsed || '',
    tags: entry.tags || [],
    mood: entry.mood || 'neutral',
    conversation: entry.conversation || [],
    location: entry.location || undefined,
    updatedAt: now,
    createdAt: entry.createdAt || now,
  };

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

  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
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
      onUpdate(entries);
    },
    (error) => {
      console.error('Firestore listener error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;
  const entryDoc = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryDoc);
}

// -------------------------------------------------------------
// Role-Based Access Control (RBAC) & Admin Services
// -------------------------------------------------------------

// Known primary administrator email
const SUPERADMIN_EMAIL = 'krishnaraddi@gmail.com';

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

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const now = new Date().toISOString();

  const isSuperadmin = Boolean(
    user.email && user.email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
  );

  if (!userSnap.exists()) {
    const initialProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || 'User',
      email: user.email || '',
      photoURL: user.photoURL || null,
      role: isSuperadmin ? 'admin' : 'user',
      status: 'active',
      createdAt: now,
      lastLoginAt: now,
    };

    const sanitized = sanitizeFirestorePayload(initialProfile);
    await setDoc(userRef, sanitized);
    return initialProfile;
  } else {
    const existing = userSnap.data() as UserProfile;
    // Determine updated role (promote superadmin if needed)
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
      console.error('Error listening to user profile:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener for all users (Admin only)
 */
export function subscribeToAllUsers(
  onUpdate: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
): () => void {
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
      // Sort admins first, then by lastLogin
      users.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return (b.lastLoginAt || '').localeCompare(a.lastLoginAt || '');
      });
      onUpdate(users);
    },
    (err) => {
      console.error('Admin users listener error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Record an audit log entry in /admin_audit_logs
 */
export async function recordAuditLog(log: Omit<AdminAuditLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const logsRef = collection(db, 'admin_audit_logs');
    const newLogDoc = doc(logsRef);
    const payload: AdminAuditLog = {
      id: newLogDoc.id,
      actorUid: log.actorUid,
      actorEmail: log.actorEmail,
      action: log.action,
      targetUid: log.targetUid,
      targetEmail: log.targetEmail,
      details: log.details,
      timestamp: new Date().toISOString(),
    };
    await setDoc(newLogDoc, sanitizeFirestorePayload(payload));
  } catch (err) {
    console.error('Failed to record admin audit log:', err);
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

