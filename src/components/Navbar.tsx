import React from 'react';
import { Sparkles, LogOut, ShieldCheck, User, MapPin, Shield } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  onSignOut: () => void;
  onSignIn: () => void;
  activeTab: 'editor' | 'history' | 'map' | 'security' | 'admin';
  setActiveTab: (tab: 'editor' | 'history' | 'map' | 'security' | 'admin') => void;
  entriesCount: number;
  geotaggedCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onSignOut,
  onSignIn,
  activeTab,
  setActiveTab,
  entriesCount,
  geotaggedCount = 0,
}) => {
  const isAdmin = user?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-stone-900 text-stone-100 border-b border-stone-800 backdrop-blur-md bg-opacity-95">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 font-bold shadow-md">
            <Sparkles className="w-5 h-5 text-stone-950" />
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg tracking-tight text-white leading-none">
              Gemini Journal
            </h1>
            <span className="text-[11px] text-stone-400 font-medium tracking-wide">
              Isolated Reflections &amp; AI Insights
            </span>
          </div>
        </div>

        {/* Navigation Tabs if Logged In */}
        {user && (
          <nav className="hidden md:flex items-center bg-stone-800/80 p-1 rounded-xl border border-stone-700/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'editor'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              New Reflection
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <span>Past Entries</span>
              <span className="bg-stone-700 text-stone-200 text-[10px] px-1.5 py-0.2 rounded-full">
                {entriesCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Memories Map</span>
              {geotaggedCount > 0 && (
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] px-1.5 py-0.2 rounded-full">
                  {geotaggedCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                activeTab === 'security'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Security &amp; Rules</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-purple-600 text-white shadow-sm font-bold'
                    : 'text-purple-300 hover:text-white bg-purple-950/40 border border-purple-800/50'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-purple-400" />
                <span>Admin Console</span>
              </button>
            )}
          </nav>
        )}

        {/* User Profile / Auth State */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-right hidden sm:flex">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-stone-700 ring-2 ring-amber-500/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-300">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="text-left">
                  <div className="flex items-center gap-1.5 leading-tight">
                    <p className="text-xs font-semibold text-stone-200">
                      {user.displayName || 'Authenticated User'}
                    </p>
                    {user.role === 'admin' && (
                      <span className="bg-purple-900/80 text-purple-300 border border-purple-700/60 text-[9px] px-1 py-0.2 rounded font-mono font-bold">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-400 leading-tight truncate max-w-[120px]">
                    {user.email || 'Google Auth'}
                  </p>
                </div>
              </div>


              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1.5 text-xs font-semibold text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 px-3 py-2 rounded-xl border border-stone-700 transition"
                title="Sign out of Firebase"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-2 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 px-4 py-2 rounded-xl shadow transition"
            >
              <span>Sign In with Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
