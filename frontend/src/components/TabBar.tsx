import React from 'react';
import { Mail, Folder, Plus, X } from 'lucide-react';

interface TabBarProps {
  projectIds: string[];
  activeTab: string; // 'emails' | projectId
  onSelectTab: (tabId: string) => void;
  onCloseTab: (projectId: string) => void;
  onOpenNewTabModal: () => void;
  unassignedEmailCount?: number;
  projectTitles?: Record<string, string>;
}

export const TabBar: React.FC<TabBarProps> = ({
  projectIds,
  activeTab,
  onSelectTab,
  onCloseTab,
  onOpenNewTabModal,
  unassignedEmailCount = 0,
  projectTitles = {},
}) => {
  return (
    <div
      data-testid="workspace-tab-bar"
      className="h-10 bg-[#161b22] border-b border-[#30363d] flex items-center px-2 space-x-1 overflow-x-auto select-none no-scrollbar shrink-0"
    >
      {/* Pinned Emails Tab */}
      <button
        type="button"
        onClick={() => onSelectTab('emails')}
        data-testid="tab-emails"
        className={`h-8 px-3 rounded-t-md flex items-center space-x-2 text-xs font-medium border-t-2 transition-all shrink-0 ${
          activeTab === 'emails'
            ? 'bg-[#0d1117] text-white border-t-blue-500 border-x border-[#30363d]'
            : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[#21262d] border-t-transparent border-x border-transparent'
        }`}
      >
        <Mail className="w-3.5 h-3.5 text-blue-400" />
        <span>Emails</span>
        {unassignedEmailCount > 0 && (
          <span
            data-testid="tab-emails-badge"
            className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-600 text-white"
          >
            {unassignedEmailCount}
          </span>
        )}
      </button>

      <div className="h-4 w-px bg-[#30363d] mx-1 shrink-0" />

      {/* Dynamic Project Tabs */}
      {projectIds.map((pid) => {
        const isActive = activeTab === pid;
        const title = projectTitles[pid] || 'Project';

        return (
          <div
            key={pid}
            data-testid={`tab-project-${pid}`}
            onClick={() => onSelectTab(pid)}
            className={`group h-8 px-3 rounded-t-md flex items-center space-x-2 text-xs font-medium border-t-2 transition-all cursor-pointer shrink-0 max-w-[220px] ${
              isActive
                ? 'bg-[#0d1117] text-white border-t-blue-500 border-x border-[#30363d]'
                : 'bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[#21262d] border-t-transparent border-x border-transparent'
            }`}
          >
            <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-gray-500'}`} />
            <span className="truncate font-medium" title={title}>
              {title}
            </span>
            <button
              type="button"
              data-testid={`tab-close-btn-${pid}`}
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(pid);
              }}
              className="p-0.5 rounded text-gray-500 hover:text-gray-200 hover:bg-[#30363d] transition-colors shrink-0 ml-1 opacity-70 group-hover:opacity-100"
              title="Close tab"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {/* Plus '+' Button to Open or Create Project Tab */}
      <button
        type="button"
        onClick={onOpenNewTabModal}
        data-testid="tab-new-project-btn"
        className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#21262d] border border-transparent hover:border-[#30363d] transition-colors shrink-0 ml-1"
        title="Open or create project tab"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
