import React from 'react';
import { Terminal } from 'lucide-react';

interface HeaderProps {
  connected?: boolean;
  projectId?: string;
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header
      data-testid="header"
      className="h-12 border-b border-[#30363d] bg-[#161b22] px-4 flex items-center justify-between select-none shrink-0"
    >
      <div className="flex items-center space-x-3">
        <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-md border border-blue-500/30">
          <Terminal className="w-4 h-4" />
        </div>
        <div className="flex items-center space-x-2">
          <h1 className="text-sm font-bold text-gray-100 tracking-wide">SCRIPTORIUM</h1>
          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[#21262d] text-gray-400 border border-[#30363d]">
            Supervisor
          </span>
        </div>
      </div>
    </header>
  );
};
