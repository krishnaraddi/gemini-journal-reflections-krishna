import React, { useState, useEffect } from 'react';
import { listenToAuthState, signInWithGoogle, signOutUser } from './firebase';
import { UserProfile } from './types';
import { LandingView } from './components/LandingView';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { ToastContainer, ToastMessage } from './components/Toast';
import { RefreshCw, AlertCircle } from 'lucide-react';

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
    const unsubscribe = listenToAuthState((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const loggedUser = await signInWithGoogle();
      setUser({
        uid: loggedUser.uid,
        displayName: loggedUser.displayName,
        email: loggedUser.email,
        photoURL: loggedUser.photoURL,
      });
      addToast('success', `Welcome, ${loggedUser.displayName || 'Friend'}!`);
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      // Suppress popup closed by user errors with friendly notice
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
          <p className="text-stone-600 text-sm font-medium">Connecting to Firebase Auth...</p>
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
              <span>Google Firebase Auth • Isolated Cloud Firestore • Gemini 3.6 Flash</span>
            </div>
          </footer>

          <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </div>
      )}
    </div>
  );
}
