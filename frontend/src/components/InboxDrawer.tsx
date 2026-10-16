import React from 'react';
import { X, Mail, ArrowRight, Clock } from 'lucide-react';
import { ProjectEmail } from '../types';

interface InboxDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId: string;
  emails: ProjectEmail[];
  onAssignEmail: (emailId: string) => Promise<void>;
  assigningId: string | null;
}

export const InboxDrawer: React.FC<InboxDrawerProps> = ({
  isOpen,
  onClose,
  activeProjectId,
  emails,
  onAssignEmail,
  assigningId,
}) => {
  if (!isOpen) return null;

  return (
    <div
      data-testid="inbox-drawer"
      className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#161b22] border-l border-[#30363d] shadow-2xl z-50 flex flex-col transition-all duration-300 ease-in-out"
    >
      {/* Drawer Header */}
      <div className="h-14 px-4 border-b border-[#30363d] flex items-center justify-between bg-[#1f242c]">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-md border border-blue-500/30">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-100 flex items-center space-x-2">
              <span>Incoming Emails</span>
              <span
                data-testid="inbox-count-pill"
                className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40"
              >
                {emails.length}
              </span>
            </h2>
            <p className="text-[11px] text-gray-400">
              Unassigned inbox messages awaiting project association
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          data-testid="inbox-drawer-close"
          className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-[#30363d] transition-colors"
          title="Close inbox"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Target Project Banner */}
      <div className="px-4 py-2.5 bg-[#0d1117]/80 border-b border-[#30363d] text-xs text-gray-300 flex items-center justify-between">
        <span>Active Project:</span>
        <span className="font-mono text-blue-400 font-semibold px-2 py-0.5 rounded bg-blue-950/40 border border-blue-800/40">
          {activeProjectId}
        </span>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {emails.length === 0 ? (
          <div
            data-testid="inbox-empty-message"
            className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-3"
          >
            <div className="p-3 bg-[#21262d] rounded-full text-gray-400">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">No unassigned emails</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[240px]">
                All incoming correspondence has been associated with Scriptorium projects.
              </p>
            </div>
          </div>
        ) : (
          emails.map((email) => {
            const isAssigning = assigningId === email.id;

            return (
              <div
                key={email.id}
                data-testid="inbox-email-card"
                className="p-3.5 rounded-lg bg-[#21262d] border border-[#30363d] hover:border-gray-500/50 transition-all flex flex-col space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p
                      data-testid="inbox-email-subject"
                      className="text-xs font-semibold text-gray-200 truncate"
                    >
                      {email.subject}
                    </p>
                    <p
                      data-testid="inbox-email-from"
                      className="text-[11px] text-gray-400 truncate mt-0.5"
                    >
                      From: <span className="text-gray-300 font-mono">{email.from}</span>
                    </p>
                  </div>
                  {email.timestamp && (
                    <div
                      data-testid="inbox-email-date"
                      className="flex items-center space-x-1 text-[10px] text-gray-500 shrink-0 font-mono"
                    >
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span>{new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                {email.body && (
                  <p
                    data-testid="inbox-email-body"
                    className="text-xs text-gray-400 line-clamp-2 bg-[#161b22] p-2 rounded border border-[#30363d]/60 font-sans"
                  >
                    {email.body}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono text-gray-500">
                    {email.id}
                  </span>
                  <button
                    onClick={() => onAssignEmail(email.id)}
                    disabled={isAssigning}
                    data-testid="inbox-assign-btn"
                    className="flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
                  >
                    <span>{isAssigning ? 'Assigning...' : `Assign to ${activeProjectId}`}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
