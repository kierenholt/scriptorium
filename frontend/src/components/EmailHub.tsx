import React, { useState } from 'react';
import {
  Mail,
  Search,
  Clock,
  ArrowRight,
  CheckCircle2,
  Inbox,
  Send,
  ExternalLink,
  Loader2,
  Folder,
} from 'lucide-react';
import { ProjectEmail } from '../types';
import { isValidEntityId } from '../services/entityId';

interface EmailHubProps {
  emails: ProjectEmail[];
  openProjectIds: string[];
  activeProjectId?: string;
  onAssignEmail: (emailId: string, targetProjectId: string) => Promise<void>;
  assigningId: string | null;
  onSwitchToProject: (projectId: string) => void;
  projectTitles?: Record<string, string>;
}

export const EmailHub: React.FC<EmailHubProps> = ({
  emails,
  openProjectIds,
  activeProjectId,
  onAssignEmail,
  assigningId,
  onSwitchToProject,
  projectTitles = {},
}) => {
  const [filter, setFilter] = useState<'inbox' | 'unassigned' | 'assigned'>('unassigned');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [manualProjectId, setManualProjectId] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Filter emails based on category and search query
  const filteredEmails = emails.filter((email) => {
    if (filter === 'unassigned' && email.projectId) return false;
    if (filter === 'assigned' && !email.projectId) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const subjectMatch = (email.subject || '').toLowerCase().includes(q);
      const fromMatch = (email.from || '').toLowerCase().includes(q);
      const bodyMatch = (email.body || '').toLowerCase().includes(q);
      const idMatch = (email.id || '').toLowerCase().includes(q);
      return subjectMatch || fromMatch || bodyMatch || idMatch;
    }

    return true;
  });

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) || filteredEmails[0] || null;

  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail) return;
    const target = manualProjectId.trim().toLowerCase();
    if (!isValidEntityId(target, 'pr')) {
      setManualError('Target must be a valid project ID (e.g. pr-7k4x9q)');
      return;
    }

    setManualError(null);
    await onAssignEmail(selectedEmail.id, target);
    setManualProjectId('');
  };

  return (
    <div
      data-testid="email-hub-view"
      className="flex-1 h-full flex flex-col md:flex-row bg-[#0d1117] overflow-hidden"
    >
      {/* Left Column: Email List & Search */}
      <div className="w-full md:w-[420px] h-full flex flex-col border-r border-[#30363d] bg-[#161b22]">
        {/* Search & Filter Header */}
        <div className="p-3 border-b border-[#30363d] space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject, sender, content..."
              data-testid="email-search-input"
              className="w-full bg-[#0d1117] text-gray-200 placeholder-gray-500 text-xs pl-9 pr-3 py-2 rounded-md border border-[#30363d] focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex rounded-md bg-[#0d1117] p-0.5 border border-[#30363d]">
            <button
              type="button"
              onClick={() => setFilter('inbox')}
              data-testid="email-filter-inbox"
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                filter === 'inbox'
                  ? 'bg-[#21262d] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Inbox ({emails.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unassigned')}
              data-testid="email-filter-unassigned"
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                filter === 'unassigned'
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Unassigned ({emails.filter((e) => !e.projectId).length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('assigned')}
              data-testid="email-filter-assigned"
              className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${
                filter === 'assigned'
                  ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Assigned ({emails.filter((e) => !!e.projectId).length})
            </button>
          </div>
        </div>

        {/* Email Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredEmails.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-500 space-y-2">
              <Mail className="w-8 h-8 text-gray-600 mb-1" />
              <p className="text-xs font-medium text-gray-400">No matching emails</p>
              <p className="text-[11px] text-gray-500">
                {filter === 'unassigned'
                  ? 'No unassigned messages awaiting triage.'
                  : filter === 'assigned'
                  ? 'No assigned messages found.'
                  : 'Try adjusting your search filter.'}
              </p>
            </div>
          ) : (
            filteredEmails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              const isAssigned = !!email.projectId;

              return (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmailId(email.id)}
                  data-testid="email-hub-card"
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#21262d] border-blue-500/60 shadow-md'
                      : 'bg-[#0d1117] border-[#30363d] hover:border-gray-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-gray-200 truncate flex-1">
                      {email.subject || '(No Subject)'}
                    </span>
                    {email.direction === 'inbound' ? (
                      <span className="inline-flex items-center text-[10px] font-medium text-blue-400 bg-blue-950/40 border border-blue-800/40 px-1.5 py-0.2 rounded shrink-0">
                        <Inbox className="w-2.5 h-2.5 mr-1" />
                        In
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-medium text-purple-400 bg-purple-950/40 border border-purple-800/40 px-1.5 py-0.2 rounded shrink-0">
                        <Send className="w-2.5 h-2.5 mr-1" />
                        Out
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-400 truncate mb-1">
                    From: <span className="text-gray-300 font-mono">{email.from}</span>
                  </p>

                  {email.body && (
                    <p className="text-[11px] text-gray-400 line-clamp-2 mb-2 font-sans">
                      {email.body}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[#30363d]/60 text-[10px] text-gray-500">
                    <span className="font-mono">{email.id}</span>
                    <div className="flex items-center space-x-2">
                      {isAssigned ? (
                        <span className="text-emerald-400 font-mono flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{email.projectId}</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium">Unassigned</span>
                      )}
                      {email.timestamp && (
                        <span>{new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Selected Email Inspector & Assignment Bar */}
      <div className="flex-1 h-full flex flex-col bg-[#0d1117] overflow-hidden">
        {selectedEmail ? (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Email Header Pane */}
            <div className="p-4 border-b border-[#30363d] bg-[#161b22]/70 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <h2
                  data-testid="email-detail-subject"
                  className="text-base font-bold text-gray-100"
                >
                  {selectedEmail.subject || '(No Subject)'}
                </h2>
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="font-mono text-xs text-gray-400 bg-[#0d1117] px-2 py-0.5 rounded border border-[#30363d]">
                    {selectedEmail.id}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400 pt-1">
                <div>
                  <span className="text-gray-500">From:</span>{' '}
                  <span className="text-gray-200 font-mono">{selectedEmail.from}</span>
                </div>
                <div>
                  <span className="text-gray-500">To:</span>{' '}
                  <span className="text-gray-200 font-mono">
                    {Array.isArray(selectedEmail.to) ? selectedEmail.to.join(', ') : selectedEmail.to}
                  </span>
                </div>
                {selectedEmail.timestamp && (
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span>
                      {new Date(selectedEmail.timestamp).toLocaleString()}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Direction:</span>{' '}
                  <span className="capitalize text-gray-300 font-medium">
                    {selectedEmail.direction}
                  </span>
                </div>
              </div>

              {/* Assignment Bar */}
              <div className="pt-2 border-t border-[#30363d]">
                {selectedEmail.projectId ? (
                  <div className="flex items-center justify-between p-2 rounded bg-emerald-950/30 border border-emerald-800/40">
                    <div className="flex items-center space-x-2 text-xs text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>
                        Assigned to project:{' '}
                        <strong className="font-mono text-emerald-200 font-semibold">
                          {selectedEmail.projectId}
                        </strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSwitchToProject(selectedEmail.projectId!)}
                      data-testid="emailhub-jump-project-btn"
                      className="flex items-center space-x-1 text-xs text-emerald-300 hover:text-white px-2.5 py-1 rounded bg-emerald-900/40 hover:bg-emerald-800/50 border border-emerald-700/50 transition-colors"
                    >
                      <span>Open Tab</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#21262d] border border-[#30363d] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                        <Folder className="w-3.5 h-3.5 text-blue-400" />
                        <span>Assign to Scriptorium Project:</span>
                      </span>
                      {assigningId === selectedEmail.id && (
                        <span className="flex items-center space-x-1 text-xs text-blue-400 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Assigning...</span>
                        </span>
                      )}
                    </div>

                    {/* Quick Assign Buttons for currently open project tabs */}
                    <div className="flex flex-wrap gap-1.5">
                      {openProjectIds.map((pid) => {
                        const isCurrentActive = pid === activeProjectId;
                        const projectName = projectTitles[pid] || pid;
                        return (
                          <button
                            key={pid}
                            type="button"
                            disabled={assigningId === selectedEmail.id}
                            onClick={() => onAssignEmail(selectedEmail.id, pid)}
                            data-testid="emailhub-assign-btn"
                            data-project-id={pid}
                            title={`Assign to ${projectName}`}
                            className={`flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 rounded transition-colors disabled:opacity-50 ${
                              isCurrentActive
                                ? 'bg-blue-600 hover:bg-blue-500 text-white ring-1 ring-blue-400'
                                : 'bg-[#30363d] hover:bg-[#3f4752] text-gray-200'
                            }`}
                          >
                            <span>Assign to {projectName}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        );
                      })}
                    </div>

                    {/* Manual Project ID Input Form */}
                    <form onSubmit={handleManualAssign} className="flex space-x-2 pt-1">
                      <input
                        type="text"
                        value={manualProjectId}
                        onChange={(e) => {
                          setManualProjectId(e.target.value);
                          setManualError(null);
                        }}
                        placeholder="Or enter target project ID (pr-xxxxxx)..."
                        className="flex-1 bg-[#0d1117] text-gray-200 placeholder-gray-500 text-xs px-3 py-1.5 rounded border border-[#30363d] font-mono focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={!manualProjectId.trim() || assigningId === selectedEmail.id}
                        className="px-3 py-1.5 rounded bg-[#30363d] hover:bg-[#3f4752] text-xs text-gray-200 font-medium transition-colors disabled:opacity-40"
                      >
                        Assign
                      </button>
                    </form>
                    {manualError && (
                      <p className="text-[11px] text-red-400">{manualError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Email Message Content Body */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div
                data-testid="email-detail-body"
                className="bg-[#161b22] border border-[#30363d] rounded-lg p-5 text-gray-200 text-xs leading-relaxed whitespace-pre-wrap font-sans"
              >
                {selectedEmail.body || '(Empty body)'}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-500 space-y-2">
            <Mail className="w-10 h-10 text-gray-600 mb-1" />
            <p className="text-sm font-medium text-gray-400">Select an email</p>
            <p className="text-xs text-gray-500 max-w-sm">
              Choose an email from the left pane to view its full details and triage it into a project.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
