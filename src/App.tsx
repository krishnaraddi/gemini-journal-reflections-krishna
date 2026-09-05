import React, { useState, useEffect } from 'react';
import { listenToAuthState, signInWithGoogle, signOutUser } from './firebase';
import { syncUserProfile, subscribeToUserProfile } from './services/firestoreService';
import { UserProfile } from './types';
import { LandingView } from './components/LandingView';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { ToastContainer, ToastMessage } from './components/Toast';
import { RefreshCw, AlertCircle, ShieldAlert, LogOut } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const unsubscribe = listenToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Sync profile document and establish RBAC role
          const syncedProfile = await syncUserProfile({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          });
          setUser(syncedProfile);

          // Listen to realtime role & status updates (e.g. if promoted by another admin)
          if (profileUnsub) profileUnsub();
          profileUnsub = subscribeToUserProfile(firebaseUser.uid, (updatedProfile) => {
            if (updatedProfile) {
              setUser(updatedProfile);
            }
          });
        } catch (err) {
          console.error('Failed to sync user profile:', err);
          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            role: 'user',
            status: 'active',
          });
        }
      } else {
        if (profileUnsub) {
          profileUnsub();
          profileUnsub = null;
        }
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const loggedUser = await signInWithGoogle();
      const profile = await syncUserProfile({
        uid: loggedUser.uid,
        displayName: loggedUser.displayName,
        email: loggedUser.email,
        photoURL: loggedUser.photoURL,
      });
      setUser(profile);
      addToast('success', `Welcome, ${profile.displayName || 'Friend'}! Role: ${profile.role?.toUpperCase() || 'USER'}`);
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        addToast('info', 'Sign-in popup was closed.');
      } else {
        const msg = err?.message || 'Authentication failed. Please try again.';
        setAuthError(msg);
        addToast('error', msg);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setUser(null);
      addToast('info', 'Signed out successfully.');
    } catch (err: any) {
      console.error('Sign Out error:', err);
      addToast('error', `Failed to sign out: ${err.message}`);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
          <p className="text-stone-600 text-sm font-medium">Authenticating & Verifying Role...</p>
        </div>
      </div>
    );
  }

  // Account Suspended Barrier (OWASP A01 Access Control)
  if (user && user.status === 'suspended') {
    return (
      <div className="min-h-screen bg-stone-900 text-stone-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-stone-800 border border-red-500/40 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 bg-red-950/80 border border-red-700/60 rounded-full flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-red-300">Account Suspended</h2>
            <p className="text-xs text-stone-400 mt-1 leading-relaxed">
              Your account access has been suspended by an administrator. Please contact your organization administrator to restore access.
            </p>
          </div>
          <div className="bg-stone-900/60 p-3 rounded-lg border border-stone-700/50 text-[11px] text-stone-400 text-left font-mono">
            <div>User: {user.email || user.uid}</div>
            <div>Status: SUSPENDED</div>
            <div>Policy: OWASP A01 Broken Access Control Enforcement</div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 bg-stone-700 hover:bg-stone-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      {user ? (
        <Dashboard user={user} onSignOut={handleSignOut} />
      ) : (
        <div className="min-h-screen flex flex-col justify-between">
          <Navbar
            user={null}
            onSignOut={handleSignOut}
            onSignIn={handleGoogleSignIn}
            activeTab="editor"
            setActiveTab={() => {}}
            entriesCount={0}
          />

          {authError && (
            <div className="max-w-md mx-auto mt-4 px-4">
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 text-xs">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div className="flex-1">{authError}</div>
              </div>
            </div>
          )}

          <main className="flex-1">
            <LandingView onSignIn={handleGoogleSignIn} isLoading={isSigningIn} />
          </main>

          <footer className="border-t border-stone-200 bg-white py-6 text-center text-xs text-stone-500">
            <div className="max-w-5xl mx-auto px-4">
              <span>Google Firebase Auth • Isolated Cloud Firestore • Gemini 3.6 Flash • RBAC Security</span>
            </div>
          </footer>

          <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </div>
      )}
    </div>
  );
}

