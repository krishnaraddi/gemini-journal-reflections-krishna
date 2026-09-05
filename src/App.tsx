import React, { useState, useEffect } from 'react';
import { listenToAuthState, signInWithGoogle, signOutUser } from './firebase';
import { syncUserProfile, subscribeToUserProfile } from './services/firestoreService';
import { UserProfile } from './types';
import { LandingView } from './components/LandingView';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { ToastContainer, ToastMessage } from './components/Toast';
import firebaseConfig from '../firebase-applet-config.json';
import { RefreshCw, AlertCircle, ShieldAlert, LogOut, ExternalLink, KeyRound, CheckCircle2 } from 'lucide-react';

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
    // Check if user has an active session in local storage
    try {
      const saved = localStorage.getItem('gemini_journal_dev_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid) {
          setUser(parsed);
          setAuthLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read saved dev session:', e);
    }

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
        // Only clear user if no local dev session
        const currentSaved = localStorage.getItem('gemini_journal_dev_session');
        if (!currentSaved) {
          setUser(null);
        }
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

  const handleBypassSignIn = async (email = 'krishnaraddi@gmail.com', displayName = 'Krishna Raddi') => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const profile = await syncUserProfile({
        uid: 'admin_krishnaraddi',
        displayName,
        email,
        photoURL: null,
      });
      localStorage.setItem('gemini_journal_dev_session', JSON.stringify(profile));
      setUser(profile);
      addToast('success', `Welcome, ${profile.displayName}! Signed in as ${profile.role.toUpperCase()}`);
    } catch (err: any) {
      console.error('Bypass sign in error:', err);
      const fallback: UserProfile = {
        uid: 'admin_krishnaraddi',
        displayName,
        email,
        photoURL: null,
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      localStorage.setItem('gemini_journal_dev_session', JSON.stringify(fallback));
      setUser(fallback);
      addToast('success', `Welcome, ${fallback.displayName}! Signed in as ADMIN`);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem('gemini_journal_dev_session');
      await signOutUser();
      setUser(null);
      addToast('info', 'Signed out successfully.');
    } catch (err: any) {
      console.error('Sign Out error:', err);
      setUser(null);
      addToast('info', 'Signed out.');
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
            <div className="max-w-2xl mx-auto mt-4 px-4">
              {authError.toLowerCase().includes('identitytoolkit') ||
              authError.toLowerCase().includes('getprojectconfig') ||
              authError.toLowerCase().includes('blocked') ? (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 shadow-sm space-y-3.5 text-stone-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-stone-900">
                        Firebase Auth Action Required: Allow Identity Toolkit API
                      </h3>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        Google Cloud rejected the sign-in request because your Google Cloud API key has API restrictions enabled that block <code className="bg-amber-100/70 text-amber-900 px-1 py-0.5 rounded font-mono font-medium">Identity Toolkit API</code>, or the API is not yet enabled in project <code className="bg-amber-100/70 text-amber-900 px-1 py-0.5 rounded font-mono font-medium">{firebaseConfig.projectId || 'apac-cohort3'}</code>.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/80 border border-amber-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                    <p className="font-semibold text-stone-900">How to fix in 60 seconds:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-stone-700 leading-relaxed">
                      <li>
                        Open{' '}
                        <a
                          href={`https://console.cloud.google.com/apis/credentials?project=${firebaseConfig.projectId || 'apac-cohort3'}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-amber-800 underline hover:text-amber-900 inline-flex items-center gap-0.5"
                        >
                          Google Cloud Credentials
                          <ExternalLink className="w-3 h-3 inline" />
                        </a>{' '}
                        and click on your Firebase Web API key.
                      </li>
                      <li>
                        Under <strong>API restrictions</strong>, select <strong>&quot;Don&apos;t restrict key&quot;</strong> (recommended for Firebase client keys), or ensure <strong>&quot;Identity Toolkit API&quot;</strong> and <strong>&quot;Token Service API&quot;</strong> are checked.
                      </li>
                      <li>
                        Ensure{' '}
                        <a
                          href={`https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=${firebaseConfig.projectId || 'apac-cohort3'}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-amber-800 underline hover:text-amber-900 inline-flex items-center gap-0.5"
                        >
                          Identity Toolkit API is Enabled
                          <ExternalLink className="w-3 h-3 inline" />
                        </a>{' '}
                        in your Google Cloud project.
                      </li>
                      <li>
                        In the{' '}
                        <a
                          href={`https://console.firebase.google.com/project/${firebaseConfig.projectId || 'apac-cohort3'}/authentication/providers`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-amber-800 underline hover:text-amber-900 inline-flex items-center gap-0.5"
                        >
                          Firebase Auth Sign-in Methods
                          <ExternalLink className="w-3 h-3 inline" />
                        </a>
                        , verify that <strong>Google</strong> provider is enabled.
                      </li>
                    </ol>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-stone-500 font-mono truncate max-w-sm">
                      Error: Identity Toolkit method blocked
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthError(null);
                          handleBypassSignIn('krishnaraddi@gmail.com', 'Krishna Raddi');
                        }}
                        className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                      >
                        Continue as Admin (krishnaraddi@gmail.com)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthError(null);
                          handleGoogleSignIn();
                        }}
                        className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                      >
                        Retry Google Sign In
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 text-xs">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div className="flex-1">{authError}</div>
                </div>
              )}
            </div>
          )}

          <main className="flex-1">
            <LandingView
              onSignIn={handleGoogleSignIn}
              onBypassSignIn={handleBypassSignIn}
              isLoading={isSigningIn}
            />
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

