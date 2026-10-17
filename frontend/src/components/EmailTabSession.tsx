import React, { useState, useEffect } from 'react';
import { EmailHub } from './EmailHub';
import { ChatPanel } from './ChatPanel';
import { subscribeToMessages } from '../services/firebase';
import { ProjectEmail, ChatMessage } from '../types';

interface EmailTabSessionProps {
  isActive: boolean;
  emails: ProjectEmail[];
  openProjectIds: string[];
  activeProjectId?: string;
  onAssignEmail: (emailId: string, targetProjectId: string) => Promise<void>;
  assigningId: string | null;
  onDeleteEmail?: (emailId: string) => Promise<void>;
  onSwitchToProject: (projectId: string) => void;
  projectTitles?: Record<string, string>;
}

export const EmailTabSession: React.FC<EmailTabSessionProps> = ({
  isActive,
  emails,
  openProjectIds,
  activeProjectId,
  onAssignEmail,
  assigningId,
  onDeleteEmail,
  onSwitchToProject,
  projectTitles = {},
}) => {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const unsub = subscribeToMessages(
      'emails',
      (msgs) => {
        setMessages(msgs);
      },
      (err) => {
        console.error('Firestore email messages subscription error:', err);
      }
    );

    return () => {
      unsub();
    };
  }, []);

  return (
    <div
      data-testid="email-tab-session"
      className={isActive ? 'flex-1 flex flex-col md:flex-row overflow-hidden relative h-full' : 'hidden'}
    >
      <div className="flex-1 h-full overflow-hidden flex flex-col">
        <EmailHub
          emails={emails}
          openProjectIds={openProjectIds}
          activeProjectId={activeProjectId}
          onAssignEmail={onAssignEmail}
          assigningId={assigningId}
          onDeleteEmail={onDeleteEmail}
          onSwitchToProject={onSwitchToProject}
          projectTitles={projectTitles}
          selectedEmailId={selectedEmailId}
          onSelectEmail={setSelectedEmailId}
        />
      </div>
      <ChatPanel
        projectId="emails"
        selectedEmailId={selectedEmailId || undefined}
        persistedMessages={messages}
        title="Email Triage Agent"
      />
    </div>
  );
};
