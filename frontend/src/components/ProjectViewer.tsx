import React, { useState, useEffect } from 'react';
import { Copy, Check, FileJson, Clock, Activity } from 'lucide-react';
import { ProjectDocument } from '../types';

interface ProjectViewerProps {
  project: ProjectDocument | null;
  loading: boolean;
  error?: string | null;
}

export const ProjectViewer: React.FC<ProjectViewerProps> = ({ project, loading, error }) => {
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);

  // Flash / pulse effect when project data changes
  useEffect(() => {
    if (project) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 800);
      return () => clearTimeout(timer);
    }
  }, [project?.updatedAt, project?.status, project?.title, project?.description, JSON.stringify(project?.tags)]);

  const handleCopy = () => {
    if (!project) return;
    navigator.clipboard.writeText(JSON.stringify(project, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const jsonString = project ? JSON.stringify(project, null, 2) : '';

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0d1117] border-r border-[#30363d] overflow-hidden">
      {/* Pane Header */}
      <div className="h-10 border-b border-[#30363d] px-4 flex items-center justify-between bg-[#161b22]/70 select-none">
        <div className="flex items-center space-x-2">
          <FileJson className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-gray-300 tracking-wide uppercase">
            Live Document: <span className="font-mono text-gray-100">projects/{project?.id || '...'}</span>
          </span>
          {pulse && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all">
              UPDATED
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-xs text-gray-400">
          {project?.updatedAt && (
            <div className="flex items-center space-x-1 font-mono text-[11px] text-gray-400">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span>Synced: {new Date(project.updatedAt).toLocaleTimeString()}</span>
            </div>
          )}

          <button
            onClick={handleCopy}
            disabled={!project}
            className="flex items-center space-x-1 text-xs text-gray-300 hover:text-white px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] transition-colors disabled:opacity-40"
            title="Copy raw JSON"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Pane Body */}
      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
            <Activity className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Connecting to Firestore document...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-red-400 p-6 text-center space-y-2">
            <p className="font-semibold text-sm">Failed to load project document</p>
            <p className="text-xs text-red-300 font-mono bg-red-950/40 p-3 rounded border border-red-800/40 max-w-lg">
              {error}
            </p>
          </div>
        ) : !project ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
            <p className="text-sm">No project record found in Firestore.</p>
            <p className="text-xs text-gray-400">Click &quot;Seed / Reset Project&quot; in the header to create the initial document.</p>
          </div>
        ) : (
          <pre
            data-testid="project-raw-json"
            className={`font-mono text-xs sm:text-sm p-4 rounded-lg bg-[#161b22] border transition-all duration-300 text-gray-200 overflow-x-auto leading-relaxed ${
              pulse ? 'border-emerald-500/80 shadow-lg shadow-emerald-500/10' : 'border-[#30363d]'
            }`}
          >
            <code>{jsonString}</code>
          </pre>
        )}
      </div>
    </div>
  );
};
