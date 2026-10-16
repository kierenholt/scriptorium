import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { ProjectTabSession } from './components/ProjectTabSession';
import { EmailHub } from './components/EmailHub';
import { OpenProjectModal } from './components/OpenProjectModal';
import { StandaloneProjectView } from './components/StandaloneProjectView';
import { subscribeToInboxEmails, subscribeToAllEmails, fetchRecentProjectsList } from './services/firebase';
import { assignEmailToProject, fetchInboxEmails } from './services/api';
import { ProjectEmail } from './types';
import { isValidEntityId } from './services/entityId';
import { AccessDenied } from './components/AccessDenied';
import { config } from './config';

const STORAGE_KEY_TABS = 'scriptorium_open_tabs';
const STORAGE_KEY_ACTIVE = 'scriptorium_active_tab';
const TOKEN_STORAGE_KEY = 'scriptorium_supervisor_token';

const SupervisorConsole: React.FC = () => {
  // Determine initial project and tab from URL or localStorage
  const getInitialState = () => {
    let urlProjectId: string | null = null;
    let urlTab: string | null = null;

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paramId = params.get('projectId');
      if (paramId && isValidEntityId(paramId.trim(), 'pr')) {
        urlProjectId = paramId.trim();
      }
      const paramTab = params.get('tab');
      if (paramTab && paramTab.trim() === 'emails') {
        urlTab = 'emails';
      }
    }

    const storedTabsRaw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_TABS) : null;
    let savedTabs: string[] = [];
    try {
      if (storedTabsRaw) {
        const parsed = JSON.parse(storedTabsRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          savedTabs = parsed.filter((id) => isValidEntityId(id, 'pr'));
        }
      }
    } catch {
      // Fallback
    }

    if (urlProjectId && !savedTabs.includes(urlProjectId)) {
      savedTabs.push(urlProjectId);
    }

    let initialActive = urlTab || urlProjectId;
    if (!initialActive) {
      try {
        const storedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
        if (storedActive && (storedActive === 'emails' || savedTabs.includes(storedActive))) {
          initialActive = storedActive;
        }
      } catch {
        // Fallback
      }
    }

    if (!initialActive) {
      initialActive = savedTabs[0] || 'emails';
    }

    const isFirstVisit = storedTabsRaw === null && !urlProjectId && !urlTab;

    return { initialTabs: savedTabs, initialActive, isFirstVisit };
  };

  const [initialData] = useState(getInitialState);
  const [openProjectIds, setOpenProjectIds] = useState<string[]>(initialData.initialTabs);
  const [activeTab, setActiveTab] = useState<string>(initialData.initialActive);
  const [projectTitles, setProjectTitles] = useState<Record<string, string>>({});
  const [inboxEmails, setInboxEmails] = useState<ProjectEmail[]>([]);
  const [allEmails, setAllEmails] = useState<ProjectEmail[]>([]);
  const [isNewTabModalOpen, setIsNewTabModalOpen] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);

  // Sync state changes to localStorage and URL
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(openProjectIds));
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeTab);
    } catch {
      // Ignore localStorage write errors
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      if (activeTab === 'emails') {
        url.searchParams.set('tab', 'emails');
        url.searchParams.delete('projectId');
      } else {
        url.searchParams.set('projectId', activeTab);
        url.searchParams.delete('tab');
      }
      window.history.replaceState(null, '', url.toString());
    }
  }, [openProjectIds, activeTab]);

  const refreshInbox = useCallback(async () => {
    try {
      const emails = await fetchInboxEmails();
      setInboxEmails(emails);
    } catch {
      // Ignore network errors on uninitialized backend
    }
  }, []);

  // Subscriptions for Inbox and All Emails
  useEffect(() => {
    refreshInbox();

    const unsubInbox = subscribeToInboxEmails(
      (emails) => {
        setConnected(true);
        if (emails.length > 0) {
          setInboxEmails((prev) => {
            const combined = [...emails];
            for (const p of prev) {
              if (!combined.some((c) => c.id === p.id || c.resendId === p.id)) {
                combined.push(p);
              }
            }
            return combined;
          });
        } else {
          setInboxEmails([]);
        }
      },
      (err) => {
        console.error('Firestore inbox emails subscription error:', err);
      }
    );

    const unsubAll = subscribeToAllEmails(
      (emails) => {
        setAllEmails(emails);
      },
      (err) => {
        console.error('Firestore all emails subscription error:', err);
      }
    );

    return () => {
      unsubInbox();
      unsubAll();
    };
  }, [refreshInbox]);

  // If first visit without explicit tabs or URL params, load most recent existing project from Firestore
  useEffect(() => {
    if (initialData.isFirstVisit && openProjectIds.length === 0) {
      fetchRecentProjectsList(1)
        .then((recents) => {
          if (recents.length > 0 && recents[0]?.id) {
            const firstId = recents[0].id;
            setOpenProjectIds([firstId]);
            setActiveTab(firstId);
          }
        })
        .catch(() => {
          // If offline or no projects, stay on 'emails'
        });
    }
  }, [initialData.isFirstVisit]);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleCloseTab = (closingProjectId: string) => {
    const updated = openProjectIds.filter((id) => id !== closingProjectId);
    setOpenProjectIds(updated);

    if (activeTab === closingProjectId) {
      setActiveTab(updated[0] || 'emails');
    }
  };

  const handleOpenProject = (projectId: string, title?: string) => {
    if (!openProjectIds.includes(projectId)) {
      setOpenProjectIds((prev) => [...prev, projectId]);
    }
    if (title) {
      setProjectTitles((prev) => ({ ...prev, [projectId]: title }));
    }
    setActiveTab(projectId);
  };

  const handleProjectTitleUpdate = useCallback((id: string, title: string) => {
    setProjectTitles((prev) => {
      if (prev[id] === title) return prev;
      return { ...prev, [id]: title };
    });
  }, []);

  // Determine current active project ID for Header and operations
  const currentProjectId = activeTab !== 'emails' ? activeTab : (openProjectIds[0] || '');

  const handleAssignEmail = async (emailId: string, targetProjectId?: string) => {
    const target = targetProjectId || currentProjectId;
    try {
      setAssigningId(emailId);
      await assignEmailToProject(emailId, target);
      await refreshInbox();
    } catch (err: any) {
      console.error('Failed to assign email to project:', err);
      alert(`Failed to assign email: ${err.message}`);
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1117] text-gray-200">
      {/* Global Header */}
      <Header
        connected={connected}
      />

      {/* Horizontal Top Tab Bar */}
      <TabBar
        projectIds={openProjectIds}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onOpenNewTabModal={() => setIsNewTabModalOpen(true)}
        unassignedEmailCount={inboxEmails.length}
        projectTitles={projectTitles}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Special Pinned "Emails" Tab Content */}
        {activeTab === 'emails' && (
          <EmailHub
            emails={allEmails.length > 0 ? allEmails : inboxEmails}
            openProjectIds={openProjectIds}
            activeProjectId={currentProjectId}
            onAssignEmail={handleAssignEmail}
            assigningId={assigningId}
            onSwitchToProject={handleOpenProject}
            projectTitles={projectTitles}
          />
        )}

        {/* Project Tab Sessions (preserved in memory with display: none for seamless background streaming) */}
        {openProjectIds.map((pid) => (
          <ProjectTabSession
            key={pid}
            projectId={pid}
            isActive={activeTab === pid}
            onProjectTitleUpdate={handleProjectTitleUpdate}
          />
        ))}

        {/* Open or Create Project Modal */}
        <OpenProjectModal
          isOpen={isNewTabModalOpen}
          onClose={() => setIsNewTabModalOpen(false)}
          onOpenProject={handleOpenProject}
          openProjectIds={openProjectIds}
        />
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  // Standalone project view is open and accessible without supervisor token
  const [standaloneProject] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('project')) {
        return params.get('project') || '';
      }
    }
    return null;
  });

  if (standaloneProject !== null) {
    return <StandaloneProjectView projectId={standaloneProject} />;
  }

  const [isAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const storedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken && storedToken === config.supervisorToken) {
      return true;
    }
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken && urlToken === config.supervisorToken) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, config.supervisorToken);
      // Clean token from address bar to prevent leaking in bookmarks and screen-sharing
      params.delete('token');
      const newSearch = params.toString() ? `?${params.toString()}` : '';
      window.history.replaceState(null, '', window.location.pathname + newSearch + window.location.hash);
      return true;
    }
    return false;
  });

  if (!isAuthenticated) {
    return <AccessDenied />;
  }

  return <SupervisorConsole />;
};

export default App;
