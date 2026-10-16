import React from 'react';
import { ShieldAlert, Terminal } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  return (
    <div
      data-testid="access-denied-screen"
      className="min-h-screen w-full bg-[#0d1117] text-gray-200 flex flex-col items-center justify-center p-6 select-none font-mono"
    >
      <div className="max-w-md w-full bg-[#161b22] border border-red-500/30 rounded-xl p-8 shadow-2xl shadow-red-950/20 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-red-950/50 border border-red-500/40 flex items-center justify-center text-red-400 mb-5">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="flex items-center space-x-2 text-xs text-red-400/80 uppercase tracking-widest font-semibold mb-2">
          <Terminal className="w-3.5 h-3.5" />
          <span>Security Gate</span>
        </div>

        <h1 className="text-xl font-bold text-gray-100 tracking-tight mb-3">
          403 — Access Denied
        </h1>

        <p className="text-sm text-gray-400 leading-relaxed">
          The Supervisor Dashboard is protected. A valid supervisor access token is required to access this console.
        </p>
      </div>

      <div className="mt-8 text-xs text-gray-600 flex items-center space-x-2">
        <span>Scriptorium Security System</span>
        <span>•</span>
        <span>europe-west2</span>
      </div>
    </div>
  );
};
