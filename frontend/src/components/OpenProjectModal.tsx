import React, { useState, useEffect } from 'react';
import { X, Folder, Plus, Search, Loader2, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import { generateEntityId, isValidEntityId } from '../services/entityId';
import { fetchRecentProjectsList } from '../services/firebase';
import { seedProject } from '../services/api';

interface OpenProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject: (projectId: string, title?: string) => void;
  openProjectIds: string[];
}

export const OpenProjectModal: React.FC<OpenProjectModalProps> = ({
  isOpen,
  onClose,
  onOpenProject,
  openProjectIds,
}) => {
  const [recentProjects, setRecentProjects] = useState<Array<{ id: string; title: string; status?: string }>>([]);
  const [loadingRecents, setLoadingRecents] = useState(false);
  const [customId, setCustomId] = useState('');
  const [customIdError, setCustomIdError] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingRecents(true);
      setCustomId('');
      setCustomIdError(null);
      setCreateError(null);
      fetchRecentProjectsList(20)
        .then((list) => {
          setRecentProjects(list);
          setLoadingRecents(false);
        })
        .catch(() => {
          setLoadingRecents(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenCustomId = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customId.trim().toLowerCase();
    if (!trimmed) return;

    if (!isValidEntityId(trimmed, 'pr')) {
      setCustomIdError('Invalid format. Project IDs must match "pr-xxxxxx" (e.g. pr-7k4x9q).');
      return;
    }

    setCustomIdError(null);
    onOpenProject(trimmed);
    onClose();
  };

  const handleCreateAndSeedNew = async () => {
    try {
      setIsCreatingNew(true);
      setCreateError(null);
      const newProjectId = generateEntityId('pr');
      const seeded = await seedProject(newProjectId);
      onOpenProject(newProjectId, (seeded as any)?.title || 'Core Creative Talent Pipeline');
      onClose();
    } catch (err: any) {
      console.error('Failed to create and seed new project:', err);
      setCreateError(err.message || 'Failed to create new project');
    } finally {
      setIsCreatingNew(false);
    }
  };

  return (
    <div
      data-testid="open-project-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-14 px-5 border-b border-[#30363d] flex items-center justify-between bg-[#1f242c]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Open or Create Project</h2>
              <p className="text-[11px] text-gray-400">Select a project or create a fresh one</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="open-project-modal-close"
            className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[#30363d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Quick Create Button */}
          <div className="p-3.5 rounded-lg bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/40 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-200 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Create New Project Document</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Auto-generates a clean pr-xxxxxx ID and seeds initial state
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateAndSeedNew}
              disabled={isCreatingNew}
              data-testid="modal-create-project-btn"
              className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 shrink-0"
            >
              {isCreatingNew ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </>
              )}
            </button>
          </div>

          {createError && (
            <div className="flex items-center space-x-2 text-xs text-red-300 bg-red-950/40 border border-red-800/40 p-2.5 rounded-md">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          {/* Open by Project ID Form */}
          <form onSubmit={handleOpenCustomId} className="space-y-2">
            <label className="text-xs font-medium text-gray-300">
              Open by Project ID:
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={customId}
                  onChange={(e) => {
                    setCustomId(e.target.value);
                    setCustomIdError(null);
                  }}
                  placeholder="e.g. pr-7k4x9q"
                  data-testid="modal-project-id-input"
                  className="w-full bg-[#0d1117] text-gray-100 placeholder-gray-500 text-xs pl-9 pr-3 py-2 rounded-md border border-[#30363d] font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={!customId.trim()}
                data-testid="modal-open-project-btn"
                className="px-4 py-2 rounded-md bg-[#21262d] hover:bg-[#30363d] text-gray-200 text-xs font-medium border border-[#30363d] transition-colors disabled:opacity-40"
              >
                Open Tab
              </button>
            </div>
            {customIdError && (
              <p className="text-[11px] text-red-400 mt-1">{customIdError}</p>
            )}
          </form>

          {/* Recent Firestore Projects */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">
              Available Projects in Database:
            </label>
            {loadingRecents ? (
              <div className="flex items-center justify-center p-6 text-gray-500 space-x-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Loading projects...</span>
              </div>
            ) : recentProjects.length === 0 ? (
              <p className="text-xs text-gray-500 p-4 text-center bg-[#0d1117] rounded-md border border-[#30363d]">
                No projects found. Create one above!
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {recentProjects.map((p) => {
                  const isOpenAlready = openProjectIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        onOpenProject(p.id, p.title);
                        onClose();
                      }}
                      className="p-2.5 rounded-md bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-medium text-gray-200 truncate">
                            {p.id}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {p.title}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        {p.status && (
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#161b22] text-gray-400 border border-[#30363d]">
                            {p.status}
                          </span>
                        )}
                        {isOpenAlready && (
                          <span className="text-[10px] text-blue-400 font-medium">
                            Already open
                          </span>
                        )}
                        <a
                          href={`/?project=${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`modal-project-only-link-${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded text-gray-400 hover:text-blue-400 hover:bg-[#21262d] border border-transparent hover:border-[#30363d] transition-colors"
                          title="Open standalone project view in a new tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
