import React, { useState } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';
import { seedProject } from '../services/api';
import { config } from '../config';

interface HeaderProps {
  connected: boolean;
  projectId?: string;
  onRefreshNeeded?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ connected, projectId, onRefreshNeeded }) => {
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const activeProjectId = projectId || config.projectId;

  const handleSeed = async () => {
    try {
      setSeeding(true);
      setSeedStatus('Seeding...');
      await seedProject(activeProjectId);
      setSeedStatus('Seeded!');
      onRefreshNeeded?.();
      setTimeout(() => setSeedStatus(null), 3000);
    } catch (err: any) {
      console.error('Seed error:', err);
      setSeedStatus(`Error: ${err.message}`);
      setTimeout(() => setSeedStatus(null), 4000);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <header className="h-14 border-b border-[#30363d] bg-[#161b22] px-4 flex items-center justify-between select-none">
      <div className="flex items-center space-x-3">
        <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-md border border-blue-500/30">
          <Terminal className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold text-gray-100 tracking-wide">SCRIPTORIUM</h1>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[#21262d] text-gray-400 border border-[#30363d]">
              Supervisor MVP
            </span>
          </div>
          <div className="text-[11px] text-gray-400 flex items-center space-x-1.5">
            <span>Project: <strong className="text-gray-300 font-mono">{activeProjectId}</strong></span>
            <span>•</span>
            <span>GCP: <strong className="text-gray-300 font-mono">scriptorium-503507</strong></span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 text-xs text-gray-400 bg-[#0d1117] px-2.5 py-1 rounded-full border border-[#30363d]">
          {connected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-400 font-medium">Firestore Live</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-amber-400 font-medium">Connecting...</span>
            </>
          )}
        </div>

        <button
          onClick={handleSeed}
          disabled={seeding}
          data-testid="seed-project-btn"
          className="flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-gray-200 border border-[#30363d] transition-colors disabled:opacity-50"
          title="Seed or restore default project document in Firestore"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin text-blue-400' : 'text-gray-400'}`} />
          <span>{seeding ? 'Seeding...' : seedStatus || 'Seed / Reset Project'}</span>
        </button>
      </div>
    </header>
  );
};
