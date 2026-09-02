import React from 'react';
import { Sparkles, Shield, Lock, BookOpen, MessageSquareQuote, CheckCircle2, ArrowRight } from 'lucide-react';

interface LandingViewProps {
  onSignIn: () => void;
  isLoading: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({ onSignIn, isLoading }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-semibold mb-6">
          <Shield className="w-3.5 h-3.5 text-amber-700" />
          <span>User-Isolated Cloud Firestore &amp; Gemini 3.6 Flash</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 mb-4 leading-tight">
          A Private Space for Deep Reflections &amp; AI Clarity
        </h1>
        <p className="text-base sm:text-lg text-stone-600 leading-relaxed mb-8">
          Write multi-turn journal reflections, receive empathetic summaries and brainstorming from Gemini, and securely persist your personal thoughts with owner-bound isolation.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={onSignIn}
            disabled={isLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg hover:shadow-xl transition transform active:scale-98 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isLoading ? 'Authenticating...' : 'Sign In with Google'}</span>
            <ArrowRight className="w-4 h-4 ml-1 text-stone-400" />
          </button>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-stone-900 text-base mb-2">Multi-Turn Reflections</h3>
          <p className="text-stone-600 text-sm leading-relaxed">
            Draft freeform thoughts, gratitude notes, or deep dilemmas. Then engage in continuous reflective dialogue with Gemini.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-stone-900 text-base mb-2">Owner-Isolated Storage</h3>
          <p className="text-stone-600 text-sm leading-relaxed">
            Data is stored exclusively under your unique Firebase user ID. Firestore rules block any access from other users.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-sm hover:shadow-md transition">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-4">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-stone-900 text-base mb-2">Gemini 3.6 Flash Engine</h3>
          <p className="text-stone-600 text-sm leading-relaxed">
            Select between Executive Summaries, Introspective Probing, Creative Brainstorming, and Cognitive Reframing.
          </p>
        </div>
      </div>

      {/* Security Architecture Highlights */}
      <div className="bg-stone-100 border border-stone-200 rounded-2xl p-6 sm:p-8">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">
          Strict Security &amp; Data Integrity Standards
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-stone-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Zero hardcoded secrets &amp; server-side API proxy</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Federated Google OAuth via Firebase Authentication</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Undefined-stripped serialization for zero database crashes</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Automatic multi-model resilient fallback ladder</span>
          </div>
        </div>
      </div>
    </div>
  );
};
