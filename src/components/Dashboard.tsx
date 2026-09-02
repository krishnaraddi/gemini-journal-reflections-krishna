import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { ActiveSession } from './ActiveSession';
import { EntryHistory } from './EntryHistory';
import { SecurityBadge } from './SecurityBadge';
import { ToastContainer, ToastMessage } from './Toast';
import { UserProfile, JournalEntry } from '../types';
import {
  saveJournalEntry,
  subscribeToUserEntries,
  deleteJournalEntry,
} from '../services/firestoreService';
import { Sparkles, Shield, Lock, FileCode, CheckCircle2 } from 'lucide-react';

interface DashboardProps {
  user: UserProfile;
  onSignOut: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onSignOut }) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'security'>('editor');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    type: 'success' | 'error' | 'info',
    message: string,
    actionLabel?: string,
    onAction?: () => void
  ) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, actionLabel, onAction }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Subscribe to user's real-time entries collection
  useEffect(() => {
    if (!user.uid) return;

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (userEntries) => {
        setEntries(userEntries);
      },
      (error) => {
        console.error('Firestore listener error:', error);
        addToast('error', `Firestore sync error: ${error.message}`);
      }
    );

    return () => unsubscribe();
  }, [user.uid]);

  // Handle saving an entry
  const handleSaveEntry = async (entry: Partial<JournalEntry>): Promise<string> => {
    const entryId = await saveJournalEntry(user.uid, entry);
    // update local active entry id
    if (!activeEntry || !activeEntry.id) {
      setActiveEntry((prev) => (prev ? { ...prev, id: entryId } : null));
    }
    return entryId;
  };

  // Handle creating new clean entry
  const handleNewEntry = () => {
    setActiveEntry(null);
    setActiveTab('editor');
    addToast('info', 'Started a fresh reflection canvas.');
  };

  // Handle selecting an entry from history
  const handleSelectEntry = (entry: JournalEntry) => {
    setActiveEntry(entry);
    setActiveTab('editor');
  };

  // Handle deleting an entry
  const handleDeleteEntry = async (entryId: string) => {
    try {
      await deleteJournalEntry(user.uid, entryId);
      if (activeEntry?.id === entryId) {
        setActiveEntry(null);
      }
      addToast('success', 'Entry removed from Firestore.');
    } catch (err: any) {
      addToast('error', `Failed to delete entry: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
      <Navbar
        user={user}
        onSignOut={onSignOut}
        onSignIn={() => {}}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        entriesCount={entries.length}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Mobile Navigation Pills */}
        <div className="flex md:hidden items-center justify-center gap-1.5 mb-6 bg-white p-1 rounded-xl border border-stone-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-2 rounded-lg transition ${
              activeTab === 'editor'
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            New Reflection
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1 ${
              activeTab === 'history'
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <span>History ({entries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2 rounded-lg transition ${
              activeTab === 'security'
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            Security
          </button>
        </div>

        {/* Tab 1: Editor & Active Reflection */}
        {activeTab === 'editor' && (
          <ActiveSession
            userId={user.uid}
            activeEntry={activeEntry}
            onSaveEntry={handleSaveEntry}
            onNewEntry={handleNewEntry}
            onDeleteEntry={handleDeleteEntry}
            addToast={addToast}
          />
        )}

        {/* Tab 2: History List */}
        {activeTab === 'history' && (
          <EntryHistory
            entries={entries}
            activeEntryId={activeEntry?.id}
            onSelectEntry={handleSelectEntry}
            onDeleteEntry={handleDeleteEntry}
            onNewEntry={handleNewEntry}
          />
        )}

        {/* Tab 3: Security & Architecture Breakdown */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <SecurityBadge />

            {/* Firestore Rules Display Card */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-amber-700" />
                <h3 className="font-bold text-stone-900 text-base">Active Firestore Security Rules</h3>
              </div>
              <p className="text-stone-600 text-xs leading-relaxed">
                Rules guarantee that only the owner of the user document tree (<code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-stone-800">request.auth.uid == userId</code>) can read or write documents.
              </p>
              <pre className="bg-stone-900 text-amber-300 font-mono text-xs p-4 rounded-xl overflow-x-auto border border-stone-800 leading-relaxed">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`}
              </pre>
            </div>

            {/* Gemini Model Fallback Architecture */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-700" />
                <h3 className="font-bold text-stone-900 text-base">Gemini API Resilient Fallback Ladder</h3>
              </div>
              <p className="text-stone-600 text-xs leading-relaxed">
                The Express backend protects against rate limits (429) or transient outage (503) by automatically cascading across fallback models:
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 font-medium text-amber-900">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  <span className="font-mono font-bold">gemini-3.6-flash</span>
                  <span className="text-stone-500 font-normal ml-auto">Primary Low-Latency Fast Reflection</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800">
                  <span className="w-5 h-5 rounded-full bg-stone-400 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                  <span className="font-mono font-bold">gemini-3.1-flash-lite</span>
                  <span className="text-stone-500 font-normal ml-auto">High-Availability Fallback</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800">
                  <span className="w-5 h-5 rounded-full bg-stone-400 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  <span className="font-mono font-bold">gemini-flash-latest</span>
                  <span className="text-stone-500 font-normal ml-auto">Dynamic Version Alias</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-800">
                  <span className="w-5 h-5 rounded-full bg-stone-400 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                  <span className="font-mono font-bold">gemini-3.7-flash</span>
                  <span className="text-stone-500 font-normal ml-auto">Deep Reasoning Fallback</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 text-center text-xs text-stone-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Authenticated as {user.email || user.displayName || user.uid}</span>
          </div>
          <div className="flex items-center gap-4 text-stone-400">
            <span>Powered by Gemini 3.6 Flash</span>
            <span>•</span>
            <span>Cloud Firestore</span>
          </div>
        </div>
      </footer>

      {/* Global Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
