import React, { useState, useEffect } from 'react';
import { ProjectViewer } from './ProjectViewer';
import { ChatPanel } from './ChatPanel';
import { subscribeToProject, subscribeToMessages } from '../services/firebase';
import { ProjectDocument, ChatMessage } from '../types';

interface ProjectTabSessionProps {
  projectId: string;
  isActive: boolean;
  onProjectTitleUpdate?: (id: string, title: string) => void;
}

export const ProjectTabSession: React.FC<ProjectTabSessionProps> = ({
  projectId,
  isActive,
  onProjectTitleUpdate,
}) => {
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Subscribe to Project document in Firestore
    const unsubProject = subscribeToProject(
      projectId,
      (data) => {
        setProject(data);
        setLoading(false);
        if (data?.title) {
          onProjectTitleUpdate?.(projectId, data.title);
        }
      },
      (err) => {
        console.error(`Firestore project subscription error [${projectId}]:`, err);
        setError(err.message);
        setLoading(false);
      }
    );

    // Subscribe to Project chat messages subcollection in Firestore
    const unsubMessages = subscribeToMessages(
      projectId,
      (msgs) => {
        setMessages(msgs);
      },
      (err) => {
        console.error(`Firestore messages subscription error [${projectId}]:`, err);
      }
    );

    return () => {
      unsubProject();
      unsubMessages();
    };
  }, [projectId]);

  return (
    <div
      data-testid={`project-session-${projectId}`}
      className={isActive ? 'flex-1 flex flex-col md:flex-row overflow-hidden relative' : 'hidden'}
    >
      <ProjectViewer projectId={projectId} project={project} loading={loading} error={error} />
      <ChatPanel projectId={projectId} persistedMessages={messages} />
    </div>
  );
};
