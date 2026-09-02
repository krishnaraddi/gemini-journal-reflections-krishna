import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { JournalEntry, ChatMessage } from '../types';
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
