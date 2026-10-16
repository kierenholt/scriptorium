import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ProjectViewer } from './components/ProjectViewer';
import { ChatPanel } from './components/ChatPanel';
import { subscribeToProject, subscribeToMessages } from './services/firebase';
import { config } from './config';
import { ProjectDocument, ChatMessage } from './types';

export const App: React.FC = () => {
  const [activeProjectId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramId = params.get('projectId');
      if (paramId && paramId.trim()) {
        return paramId.trim();
      }
    }
    return config.projectId;
  });

  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Subscribe to Project document
    const unsubProject = subscribeToProject(
      activeProjectId,
      (data) => {
        setProject(data);
        setConnected(true);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore project subscription error:', err);
        setError(err.message);
        setConnected(false);
        setLoading(false);
      }
    );

    // Subscribe to Messages
    const unsubMessages = subscribeToMessages(
      activeProjectId,
      (msgs) => {
        setMessages(msgs);
      },
      (err) => {
        console.error('Firestore messages subscription error:', err);
      }
    );

    return () => {
      unsubProject();
      unsubMessages();
    };
  }, [activeProjectId]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1117] text-gray-200">
      <Header connected={connected} projectId={activeProjectId} />
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <ProjectViewer project={project} loading={loading} error={error} />
        <ChatPanel projectId={activeProjectId} persistedMessages={messages} />
      </main>
    </div>
  );
};

export default App;
