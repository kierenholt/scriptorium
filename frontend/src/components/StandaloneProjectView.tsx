import React, { useState, useEffect } from 'react';
import { AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { ProjectViewer } from './ProjectViewer';
import { subscribeToProject, subscribeToMessages } from '../services/firebase';
import { ProjectDocument, ChatMessage } from '../types';
import { isValidEntityId } from '../services/entityId';

interface StandaloneProjectViewProps {
  projectId: string;
}

export const StandaloneProjectView: React.FC<StandaloneProjectViewProps> = ({ projectId }) => {
  const [project, setProject] = useState<ProjectDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState('');

  const trimmedId = projectId?.trim() || '';
  const isIdValid = isValidEntityId(trimmedId, 'pr');

  // Dynamically update document title based on loaded project
  useEffect(() => {
    if (!isIdValid) {
      document.title = 'Project Not Found | Scriptorium';
      return;
    }

    if (project?.title) {
      document.title = `${project.title} | Scriptorium`;
    } else {
      document.title = `${trimmedId} | Scriptorium`;
    }
  }, [project?.title, trimmedId, isIdValid]);

  // Subscribe to Project and Messages subcollections in Firestore
  useEffect(() => {
    if (!isIdValid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubProject = subscribeToProject(
      trimmedId,
      (data) => {
        setProject(data);
        setLoading(false);
      },
      (err) => {
        console.error(`Firestore project subscription error [${trimmedId}]:`, err);
        setError(err.message || 'Failed to load project from Firestore');
        setLoading(false);
      }
    );

    const unsubMessages = subscribeToMessages(
      trimmedId,
      (msgs) => {
        setMessages(msgs);
      },
      (err) => {
        console.error(`Firestore messages subscription error [${trimmedId}]:`, err);
      }
    );

    return () => {
      unsubProject();
      unsubMessages();
    };
  }, [trimmedId, isIdValid]);

  const handleNavigateToId = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = inputVal.trim();
    if (isValidEntityId(targetId, 'pr')) {
      const url = new URL(window.location.href);
      url.searchParams.set('project', targetId);
      window.location.href = url.toString();
    }
  };

  // If the projectId is missing or invalid entity ID
  if (!isIdValid) {
    return (
      <div
        data-testid="standalone-project-invalid"
        className="w-screen h-screen flex flex-col items-center justify-center bg-[#0d1117] text-gray-200 p-6"
      >
        <div className="max-w-md w-full bg-[#161b22] border border-[#30363d] rounded-xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-lg font-bold text-gray-100 tracking-tight">
              Project Not Found or Invalid ID
            </h1>
            <p className="text-xs text-gray-400 leading-relaxed">
              {trimmedId ? (
                <>
                  The identifier <code className="text-amber-400 font-mono px-1 py-0.5 bg-[#0d1117] rounded border border-[#30363d]">{trimmedId}</code> does not match the required <code className="text-gray-300 font-mono">pr-xxxxxx</code> entity format.
                </>
              ) : (
                'No project identifier was specified in the query parameter.'
              )}
            </p>
          </div>

          <form onSubmit={handleNavigateToId} className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                data-testid="standalone-project-input"
                placeholder="pr-xxxxxx"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3.5 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                data-testid="standalone-project-submit"
                disabled={!isValidEntityId(inputVal.trim(), 'pr')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                <span>View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {inputVal.trim() && !isValidEntityId(inputVal.trim(), 'pr') && (
              <p className="text-[11px] text-amber-400 text-left font-mono">
                Must be "pr-" followed by 6 alphanumeric chars (e.g. pr-7k4x9q)
              </p>
            )}
          </form>

          <div className="pt-4 border-t border-[#30363d] flex items-center justify-center">
            <a
              href="/"
              data-testid="standalone-return-supervisor-btn"
              className="inline-flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <span>Return to Supervisor Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`standalone-project-view-${trimmedId}`}
      className="w-screen h-screen flex flex-col bg-[#0d1117] text-gray-200 overflow-hidden"
    >
      <ProjectViewer
        projectId={trimmedId}
        project={project}
        loading={loading}
        error={error}
        messages={messages}
        isStandalone={true}
      />
    </div>
  );
};
