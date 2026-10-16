import React, { useState, useEffect } from 'react';
import {
  FileJson,
  Clock,
  Activity,
  LayoutDashboard,
  FileText,
  Tag,
  FolderGit2,
  Mail,
  Layers,
  Sparkles,
  Loader2,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { ProjectDocument, ProjectStatus, ProjectArtifact, ProjectEmail, ChatMessage } from '../types';
import { seedProject } from '../services/api';
import { fetchProjectMessages } from '../services/firebase';

interface ProjectViewerProps {
  projectId?: string;
  project: ProjectDocument | null;
  loading: boolean;
  error?: string | null;
  messages?: ChatMessage[];
  onLoadSubcollection?: (name: string) => Promise<ChatMessage[]>;
  isStandalone?: boolean;
}

type SectionKey = 'overview' | 'brief' | 'tags' | 'artifacts' | 'emails';

export const ProjectViewer: React.FC<ProjectViewerProps> = ({
  projectId,
  project,
  loading,
  error,
  messages,
  onLoadSubcollection,
  isStandalone = false,
}) => {
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [pulse, setPulse] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [messagesExpanded, setMessagesExpanded] = useState(false);
  const [subcollectionLoaded, setSubcollectionLoaded] = useState(Boolean(messages && messages.length > 0));
  const [loadingSubcollection, setLoadingSubcollection] = useState(false);
  const [subcollectionError, setSubcollectionError] = useState<string | null>(null);
  const [loadedMessages, setLoadedMessages] = useState<ChatMessage[]>(messages || []);
  const [copied, setCopied] = useState(false);

  // Sync if messages prop updates from parent
  useEffect(() => {
    if (messages && messages.length > 0) {
      setLoadedMessages(messages);
      setSubcollectionLoaded(true);
    }
  }, [messages]);

  const loadSubcollectionMessages = async () => {
    const targetProjectId = projectId || project?.id;
    if (!targetProjectId) return;

    setLoadingSubcollection(true);
    setSubcollectionError(null);
    try {
      let items: ChatMessage[] = [];
      if (onLoadSubcollection) {
        items = await onLoadSubcollection('messages');
      } else {
        items = await fetchProjectMessages(targetProjectId);
      }
      setLoadedMessages(items);
      setSubcollectionLoaded(true);
    } catch (err: any) {
      setSubcollectionError(err.message || 'Failed to load subcollection');
    } finally {
      setLoadingSubcollection(false);
    }
  };

  const handleToggleSubcollection = async () => {
    if (messagesExpanded) {
      setMessagesExpanded(false);
      return;
    }

    setMessagesExpanded(true);
    if (!subcollectionLoaded) {
      await loadSubcollectionMessages();
    }
  };

  const handleRefreshSubcollection = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await loadSubcollectionMessages();
  };

  // Flash / pulse effect when project data changes in real-time
  useEffect(() => {
    if (project) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 900);
      return () => clearTimeout(timer);
    }
  }, [
    project?.updatedAt,
    project?.status,
    project?.title,
    project?.description,
    JSON.stringify(project?.tags),
    JSON.stringify(project?.artifacts),
    JSON.stringify(project?.emails),
  ]);

  const baseJson = project ? JSON.stringify(project, null, 2) : '';
  const baseBody = baseJson && baseJson.lastIndexOf('}') !== -1
    ? baseJson.slice(0, baseJson.lastIndexOf('}')).trimEnd()
    : baseJson;

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'completed':
        return {
          pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400',
          label: 'completed',
        };
      case 'in_progress':
        return {
          pill: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          dot: 'bg-blue-400 animate-pulse',
          label: 'in_progress',
        };
      case 'blocked':
        return {
          pill: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          dot: 'bg-amber-400',
          label: 'blocked',
        };
      case 'draft':
      default:
        return {
          pill: 'bg-slate-700/30 text-slate-300 border-slate-600/40',
          dot: 'bg-slate-400',
          label: 'draft',
        };
    }
  };

  const navItems: { id: SectionKey; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'overview',
      label: 'Overview & Status',
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    },
    {
      id: 'brief',
      label: 'Brief & Scope',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    {
      id: 'tags',
      label: 'Requirements & Tags',
      icon: <Tag className="w-3.5 h-3.5" />,
      count: project?.tags?.length || 0,
    },
    {
      id: 'artifacts',
      label: 'Deliverables & Files',
      icon: <FolderGit2 className="w-3.5 h-3.5" />,
      count: project?.artifacts?.length || 0,
    },
    {
      id: 'emails',
      label: 'Communications',
      icon: <Mail className="w-3.5 h-3.5" />,
      count: project?.emails?.length || 0,
    },
  ];

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0d1117] border-r border-[#30363d] overflow-hidden">
      {/* Pane Header */}
      <div className="h-10 border-b border-[#30363d] px-4 flex items-center justify-between bg-[#161b22]/70 select-none">
        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0d1117] rounded p-0.5 border border-[#30363d]">
            <button
              onClick={() => setViewMode('structured')}
              data-testid="project-view-mode-toggle"
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'structured'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Switch to structured inspector"
            >
              <Layers className="w-3 h-3" />
              <span>Inspector</span>
            </button>
            <button
              onClick={() => setViewMode('raw')}
              data-testid="project-view-mode-raw"
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                viewMode === 'raw'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Switch to raw JSON viewer"
            >
              <FileJson className="w-3 h-3" />
              <span>Raw JSON</span>
            </button>
          </div>

          <span className="text-xs font-semibold text-gray-300 tracking-wide font-mono">
            projects/<span data-testid="project-id-display">{project?.id || '...'}</span>
          </span>

          {pulse && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all animate-pulse">
              UPDATED
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-xs text-gray-400">
          {project?.updatedAt && (
            <div className="hidden sm:flex items-center space-x-1 font-mono text-[11px] text-gray-400">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span>Synced: {new Date(project.updatedAt).toLocaleTimeString()}</span>
            </div>
          )}

          {!isStandalone && (projectId || project?.id) && (
            <a
              href={`/?project=${projectId || project?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="project-only-link"
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#21262d] hover:bg-[#30363d] text-blue-400 hover:text-blue-300 border border-[#30363d] transition-colors"
              title="Open standalone project view in a new tab"
            >
              <span>Project Only</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Pane Content */}
      <div className="flex-1 flex overflow-hidden">
        {loading ? (
          <div
            data-testid="project-viewer-loading"
            className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-3"
          >
            <Activity className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Connecting to Firestore document...</p>
          </div>
        ) : error ? (
          <div
            data-testid="project-viewer-error"
            className="flex-1 flex flex-col items-center justify-center text-red-400 p-6 text-center space-y-2"
          >
            <p className="font-semibold text-sm">Failed to load project document</p>
            <p className="text-xs text-red-300 font-mono bg-red-950/40 p-3 rounded border border-red-800/40 max-w-lg">
              {error}
            </p>
          </div>
        ) : !project ? (
          <div
            data-testid="project-viewer-empty"
            className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4 p-6 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center text-gray-400">
              <FolderGit2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-300">
                {projectId ? `No Firestore record found for ${projectId}` : 'No project record found in Firestore.'}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                This project document has not been initialized in Firestore yet.
              </p>
            </div>
            {projectId && (
              <button
                type="button"
                data-testid="seed-project-btn"
                disabled={isSeeding}
                onClick={async () => {
                  try {
                    setIsSeeding(true);
                    setSeedError(null);
                    await seedProject(projectId);
                  } catch (err: any) {
                    setSeedError(err.message || 'Failed to initialize project');
                  } finally {
                    setIsSeeding(false);
                  }
                }}
                className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow transition-colors disabled:opacity-50"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Initializing {projectId}...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                    <span>Initialize / Seed Project</span>
                  </>
                )}
              </button>
            )}
            {seedError && (
              <p className="text-xs text-red-400 font-mono bg-red-950/40 p-2 rounded border border-red-800/40">
                {seedError}
              </p>
            )}
          </div>
        ) : viewMode === 'raw' ? (
          /* Raw JSON View Mode with Expandable Subcollections */
          <div className="flex-1 p-4 overflow-auto flex flex-col space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <span className="font-mono text-gray-300">projects/{projectId || project.id}</span>
                <span className="text-gray-600">•</span>
                <span className="text-purple-400 font-mono">1 subcollection available</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  data-testid="toggle-all-subcollections-btn"
                  onClick={handleToggleSubcollection}
                  disabled={loadingSubcollection}
                  className="px-2 py-1 text-xs rounded bg-[#21262d] hover:bg-[#30363d] text-gray-300 border border-[#30363d] transition-colors disabled:opacity-50"
                >
                  {messagesExpanded
                    ? 'Collapse Subcollections'
                    : subcollectionLoaded
                    ? 'Expand Subcollections'
                    : 'Load & Expand Subcollections'}
                </button>
                <button
                  type="button"
                  data-testid="copy-json-btn"
                  onClick={async () => {
                    const toCopy = JSON.stringify(
                      {
                        ...project,
                        _subcollections: {
                          messages: subcollectionLoaded ? loadedMessages : '[Not loaded - click expander to load]',
                        },
                      },
                      null,
                      2
                    );
                    try {
                      await navigator.clipboard.writeText(toCopy);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      // Fallback if clipboard API is not available
                    }
                  }}
                  className="px-2 py-1 text-xs rounded bg-[#21262d] hover:bg-[#30363d] text-gray-300 border border-[#30363d] flex items-center space-x-1 transition-colors"
                  title="Copy full JSON with subcollections"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>
            </div>

            <pre
              data-testid="project-raw-json"
              className={`flex-1 font-mono text-xs sm:text-sm p-4 rounded-lg bg-[#161b22] border transition-all duration-300 text-gray-200 overflow-x-auto leading-relaxed ${
                pulse ? 'border-emerald-500/80 shadow-lg shadow-emerald-500/10' : 'border-[#30363d]'
              }`}
            >
              <code>
                {baseBody}
                {',\n  '}
                <span className="text-purple-400 font-semibold">"_subcollections"</span>
                {': {\n    '}
                <span className="text-blue-400 font-semibold">"messages"</span>
                {': '}
                <button
                  type="button"
                  data-testid="subcollection-messages-toggle"
                  onClick={handleToggleSubcollection}
                  disabled={loadingSubcollection}
                  className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-blue-400 hover:text-blue-300 border border-[#30363d] cursor-pointer text-xs align-middle transition-colors font-sans select-none disabled:opacity-60"
                >
                  {loadingSubcollection ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  ) : (
                    <ChevronRight
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        messagesExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  )}
                  <span>subcollection</span>
                  {subcollectionLoaded ? (
                    <span className="text-gray-400 text-[11px]">
                      ({loadedMessages.length} {loadedMessages.length === 1 ? 'doc' : 'docs'})
                    </span>
                  ) : (
                    <span className="text-amber-400/90 text-[11px] font-medium">
                      (click to load)
                    </span>
                  )}
                  <span className="text-gray-500 text-[10px]">
                    {loadingSubcollection
                      ? '[loading...]'
                      : messagesExpanded
                      ? '[click to collapse]'
                      : subcollectionLoaded
                      ? '[click to expand]'
                      : '[load & expand]'}
                  </span>
                </button>
                {subcollectionLoaded && (
                  <button
                    type="button"
                    data-testid="reload-subcollection-messages-btn"
                    onClick={handleRefreshSubcollection}
                    disabled={loadingSubcollection}
                    className="inline-flex items-center p-0.5 text-gray-400 hover:text-gray-200 transition-colors ml-1 align-middle disabled:opacity-50"
                    title="Reload subcollection documents"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingSubcollection ? 'animate-spin text-blue-400' : ''}`} />
                  </button>
                )}
                {loadingSubcollection ? (
                  <div
                    data-testid="subcollection-messages-loading"
                    className="text-gray-400 pl-6 my-1 font-mono italic text-xs flex items-center space-x-2"
                  >
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span>/* Loading messages subcollection documents from Firestore... */</span>
                  </div>
                ) : subcollectionError ? (
                  <div
                    data-testid="subcollection-messages-error"
                    className="text-red-400 pl-6 my-1 font-mono text-xs"
                  >
                    /* Error loading subcollection: {subcollectionError} */
                  </div>
                ) : messagesExpanded ? (
                  <div
                    data-testid="subcollection-messages-content"
                    className="text-emerald-400/90 pl-6 my-1 border-l-2 border-purple-500/30 ml-4 py-1"
                  >
                    {JSON.stringify(loadedMessages, null, 2)}
                  </div>
                ) : (
                  <span
                    data-testid="subcollection-messages-collapsed"
                    className="text-gray-500 text-xs ml-2 italic font-mono"
                  >
                    {subcollectionLoaded
                      ? `/* ${loadedMessages.length} documents (collapsed) */`
                      : '/* [not loaded - click to fetch] */'}
                  </span>
                )}
                {'\n  }\n}'}
              </code>
            </pre>
          </div>
        ) : (
          /* Structured Two-Column Inspector Layout */
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sub-Sidebar: Domain Navigation */}
            <div
              data-testid="project-nav-sidebar"
              className="w-56 shrink-0 border-r border-[#30363d] bg-[#161b22]/40 flex flex-col justify-between select-none"
            >
              <div className="p-2 space-y-1">
                <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Project Domain
                </div>
                {navItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      data-testid={`project-nav-${item.id}`}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d] text-blue-400'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {typeof item.count === 'number' && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isActive
                              ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                              : 'bg-[#30363d]/60 text-gray-400'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sidebar Footer Info */}
              <div className="p-3 border-t border-[#30363d] bg-[#0d1117]/40 text-[11px] text-gray-400 space-y-1">
                <div className="flex items-center justify-between text-gray-500">
                  <span>Record ID</span>
                  <span className="font-mono text-gray-300">{project.id}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Lifecycle</span>
                  <span className="font-mono text-blue-400 capitalize">{project.status}</span>
                </div>
                {!isStandalone && (
                  <div className="pt-2 border-t border-[#30363d]/50 flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">Standalone</span>
                    <a
                      href={`/?project=${project.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="sidebar-project-only-link"
                      className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                      title="Open project only view in new tab"
                    >
                      <span>Project Only</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Central Inspector Pane */}
            <div
              data-testid="project-inspector-pane"
              className="flex-1 h-full overflow-y-auto p-6 space-y-6 bg-[#0d1117]"
            >
              {/* Overview & Full Document Cards */}
              {(activeSection === 'overview' || activeSection === 'brief') && (
                <div
                  className={`rounded-lg bg-[#161b22] border p-5 transition-all duration-300 space-y-4 ${
                    pulse ? 'border-emerald-500/80 shadow-lg shadow-emerald-500/10' : 'border-[#30363d]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-mono text-gray-400 mb-1">
                        PROJECT SPECIFICATION & LIFECYCLE
                      </div>
                      <h2
                        data-testid="project-title-heading"
                        className="text-lg font-bold text-gray-100 tracking-tight"
                      >
                        {project.title}
                      </h2>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Lifecycle Status Pill */}
                      {(() => {
                        const badge = getStatusBadge(project.status);
                        return (
                          <span
                            data-testid="project-status-badge"
                            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.pill}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                            <span className="font-mono">{project.status}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#30363d]">
                    <div className="bg-[#0d1117] p-2.5 rounded border border-[#30363d]">
                      <div className="text-[10px] uppercase text-gray-500 font-semibold">Requirements</div>
                      <div className="text-base font-bold text-gray-200 mt-0.5">
                        {project.tags?.length || 0}
                      </div>
                    </div>
                    <div className="bg-[#0d1117] p-2.5 rounded border border-[#30363d]">
                      <div className="text-[10px] uppercase text-gray-500 font-semibold">Deliverables</div>
                      <div className="text-base font-bold text-gray-200 mt-0.5">
                        {project.artifacts?.length || 0}
                      </div>
                    </div>
                    <div className="bg-[#0d1117] p-2.5 rounded border border-[#30363d]">
                      <div className="text-[10px] uppercase text-gray-500 font-semibold">Emails</div>
                      <div className="text-base font-bold text-gray-200 mt-0.5">
                        {project.emails?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Brief Description */}
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-gray-400 mb-1 flex items-center space-x-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      <span>Scope of Work & Brief</span>
                    </div>
                    <div
                      data-testid="project-brief-content"
                      className="p-3 bg-[#0d1117] rounded border border-[#30363d] text-xs text-gray-200 leading-relaxed font-sans select-text whitespace-pre-wrap"
                    >
                      {project.description || 'No description provided.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Requirements & Competency Tags Card */}
              {(activeSection === 'overview' || activeSection === 'tags') && (
                <div
                  className={`rounded-lg bg-[#161b22] border p-5 transition-all duration-300 space-y-3 ${
                    pulse ? 'border-emerald-500/80 shadow-lg shadow-emerald-500/10' : 'border-[#30363d]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Tag className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">
                        Requirements & Competency Tags
                      </h3>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {project.tags?.length || 0} tag(s)
                    </span>
                  </div>

                  <div
                    data-testid="project-tags-list"
                    className="flex flex-wrap gap-2 p-3 bg-[#0d1117] rounded border border-[#30363d] min-h-[50px] items-center"
                  >
                    {!project.tags || project.tags.length === 0 ? (
                      <span className="text-xs text-gray-500 italic">No competency tags registered.</span>
                    ) : (
                      project.tags.map((tag) => (
                        <span
                          key={tag}
                          data-testid={`project-tag-${tag}`}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-[#21262d] text-gray-200 text-xs border border-[#30363d] font-mono hover:border-gray-500 transition-colors"
                        >
                          <Tag className="w-3 h-3 text-blue-400" />
                          <span>{tag}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Deliverables & Artifacts Card */}
              {(activeSection === 'overview' || activeSection === 'artifacts') && (
                <div
                  className={`rounded-lg bg-[#161b22] border p-5 transition-all duration-300 space-y-3 ${
                    pulse ? 'border-emerald-500/80 shadow-lg shadow-emerald-500/10' : 'border-[#30363d]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FolderGit2 className="w-4 h-4 text-purple-400" />
                      <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">
                        Project Artifacts & Deliverables
                      </h3>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {project.artifacts?.length || 0} file(s)
                    </span>
                  </div>

                  <div data-testid="project-artifacts-list" className="space-y-2">
                    {!project.artifacts || project.artifacts.length === 0 ? (
                      <div className="p-4 bg-[#0d1117] rounded border border-[#30363d] text-center text-xs text-gray-500 italic">
                        No deliverables or artifacts registered for this project.
                      </div>
                    ) : (
                      project.artifacts.map((art: ProjectArtifact) => (
                        <div
                          key={art.id}
                          data-testid={`project-artifact-item-${art.id}`}
                          className="p-3.5 bg-[#0d1117] rounded-md border border-[#30363d] hover:border-gray-600 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-xs text-gray-200 font-mono">
                                {art.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300 border border-purple-800/40 font-mono">
                                {art.id}
                              </span>
                            </div>
                            {art.comment && (
                              <p className="text-xs text-gray-400 font-sans">{art.comment}</p>
                            )}
                            <div className="text-[10px] text-gray-500 font-mono flex items-center space-x-2">
                              <span>MIME: {art.mimeType}</span>
                              <span>•</span>
                              <span>Added: {new Date(art.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <span
                              data-testid={`project-artifact-download-${art.id}`}
                              className="text-[11px] text-gray-400 font-mono bg-[#21262d] px-2 py-1 rounded border border-[#30363d]"
                              title={art.gcsUri}
                            >
                              {art.gcsUri.split('/').pop()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Communications & Emails Card */}
              {(activeSection === 'overview' || activeSection === 'emails') && (
                <div
                  className={`rounded-lg bg-[#161b22] border p-5 transition-all duration-300 space-y-3 ${
                    pulse ? 'border-emerald-500/80 shadow-lg shadow-emerald-500/10' : 'border-[#30363d]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-blue-400" />
                      <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wide">
                        Associated Communications
                      </h3>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {project.emails?.length || 0} message(s)
                    </span>
                  </div>

                  <div data-testid="project-emails-list" className="space-y-2">
                    {!project.emails || project.emails.length === 0 ? (
                      <div className="p-4 bg-[#0d1117] rounded border border-[#30363d] text-center text-xs text-gray-500 italic">
                        No email messages associated with this project.
                      </div>
                    ) : (
                      project.emails.map((email: ProjectEmail) => (
                        <div
                          key={email.id}
                          data-testid={`project-email-item-${email.id}`}
                          className="p-3.5 bg-[#0d1117] rounded-md border border-[#30363d] hover:border-gray-600 transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                  email.direction === 'inbound'
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                                    : 'bg-blue-950/60 text-blue-400 border-blue-800/40'
                                }`}
                              >
                                {email.direction}
                              </span>
                              <span className="text-xs font-semibold text-gray-200">
                                {email.subject}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {new Date(email.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-400 flex items-center space-x-4">
                            <span>
                              <strong className="text-gray-500">From:</strong> {email.from}
                            </span>
                            <span>
                              <strong className="text-gray-500">To:</strong>{' '}
                              {Array.isArray(email.to) ? email.to.join(', ') : email.to}
                            </span>
                          </div>

                          {email.body && (
                            <p className="text-xs text-gray-300 font-sans line-clamp-2 bg-[#161b22] p-2 rounded border border-[#30363d]/60">
                              {email.body}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
