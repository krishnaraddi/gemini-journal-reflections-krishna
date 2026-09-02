import React from 'react';
import { ShieldCheck, Lock, Database, Sparkles } from 'lucide-react';

export const SecurityBadge: React.FC = () => {
  return (
    <div className="bg-stone-900 text-stone-100 p-6 rounded-2xl border border-stone-800 shadow-md">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <h3 className="font-semibold text-base text-white">Zero-Trust Isolation Architecture</h3>
      </div>
      <p className="text-stone-300 text-sm mb-4 leading-relaxed">
        Your journal reflections and conversations are strictly isolated to your authenticated account ID using Firebase Authentication and Cloud Firestore security rules.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
            <Lock className="w-3.5 h-3.5" />
            <span>Owner-Bound Path</span>
          </div>
          <p className="text-stone-400">
            Path <code className="text-stone-300 bg-stone-950 px-1 py-0.5 rounded">/users/&#123;userId&#125;</code> rules enforce <code className="text-stone-300 bg-stone-950 px-1 py-0.5 rounded">request.auth.uid == userId</code>.
          </p>
        </div>

        <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Server Gemini Proxy</span>
          </div>
          <p className="text-stone-400">
            API keys never touch the client browser. Handled exclusively via resilient server-side proxy ladder.
          </p>
        </div>

        <div className="bg-stone-800/80 p-3 rounded-xl border border-stone-700/60">
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold mb-1">
            <Database className="w-3.5 h-3.5" />
            <span>Encrypted Firestore</span>
          </div>
          <p className="text-stone-400">
            Multi-turn chat threads & thoughts persisted with zero-crash undefined sanitization.
          </p>
        </div>
      </div>
    </div>
  );
};
