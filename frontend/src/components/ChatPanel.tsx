import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, AlertCircle, Paperclip, FileText, X, Check } from 'lucide-react';
import { ChatMessage, FileAttachment } from '../types';
import { ToolCallBadge } from './ToolCallBadge';
import { sendChatMessage, uploadFile } from '../services/api';
import { config } from '../config';

interface StagedFile {
  file: File;
  uri?: string;
  uploading: boolean;
  error?: string;
}

interface ChatPanelProps {
  projectId?: string;
  persistedMessages: ChatMessage[];
  selectedEmailId?: string;
  title?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  projectId,
  persistedMessages,
  selectedEmailId,
  title,
}) => {
  const activeProjectId = projectId || config.projectId;
  const [messages, setMessages] = useState<ChatMessage[]>(persistedMessages);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStagedFile({ file, uploading: true });
    try {
      const res = await uploadFile(file);
      setStagedFile({ file, uri: res.uri, uploading: false });
    } catch (err: any) {
      setStagedFile({ file, uploading: false, error: err.message || 'Upload failed' });
    }
  };

  const handleRemoveFile = () => {
    setStagedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sync with Firestore persisted messages when not streaming
  useEffect(() => {
    if (!isStreaming) {
      setMessages(persistedMessages);
    }
  }, [persistedMessages, isStreaming]);

  // Auto-scroll to bottom on message or status changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, statusMessage, isStreaming]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isStreaming) return;

    if (stagedFile?.uploading) {
      setErrorText('Please wait for file upload to complete before sending.');
      return;
    }

    const currentFile = stagedFile;
    const fileAttachment: FileAttachment | undefined = currentFile?.uri
      ? {
          uri: currentFile.uri,
          mimeType: currentFile.file.type,
          filename: currentFile.file.name,
        }
      : undefined;

    setStagedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setInputText('');
    setErrorText(null);
    setIsStreaming(true);
    setStatusMessage('Thinking...');

    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      sender: 'user',
      content: trimmed,
      fileAttachment,
      timestamp: new Date().toISOString(),
    };

    const agentMsg: ChatMessage = {
      id: `local-agent-${Date.now()}`,
      sender: 'agent',
      content: '',
      toolCalls: [],
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, agentMsg]);

    try {
      await sendChatMessage(
        activeProjectId,
        trimmed,
        {
          onToolCallStart: (tool) => {
          setStatusMessage(`Executing tool: ${tool.name}...`);
          setMessages((prev) => {
            const last = { ...prev[prev.length - 1] };
            const existingTools = last.toolCalls ? [...last.toolCalls] : [];
            existingTools.push({
              id: tool.id,
              name: tool.name,
              args: tool.args,
              status: 'executing',
            });
            last.toolCalls = existingTools;
            return [...prev.slice(0, -1), last];
          });
        },
        onToolCallResult: (result) => {
          setStatusMessage(`Tool ${result.name} executed`);
          setMessages((prev) => {
            const last = { ...prev[prev.length - 1] };
            const existingTools = (last.toolCalls || []).map((t) => {
              if (t.id === result.id || t.name === result.name) {
                return {
                  ...t,
                  status: result.success ? ('success' as const) : ('error' as const),
                  result: result.result,
                  error: result.error,
                };
              }
              return t;
            });
            last.toolCalls = existingTools;
            return [...prev.slice(0, -1), last];
          });
        },
        onTextChunk: (chunk) => {
          setStatusMessage(null);
          setMessages((prev) => {
            const last = { ...prev[prev.length - 1] };
            last.content = (last.content || '') + chunk;
            return [...prev.slice(0, -1), last];
          });
        },
        onDone: () => {
          setIsStreaming(false);
          setStatusMessage(null);
        },
        onError: (err) => {
          setIsStreaming(false);
          setStatusMessage(null);
          setErrorText(err.message);
        },
      },
        fileAttachment,
        selectedEmailId
      );
    } catch (err: any) {
      setIsStreaming(false);
      setStatusMessage(null);
      setErrorText(err?.message || 'Failed to communicate with agent');
    }
  };

  const isEmailAgent = activeProjectId === 'emails';
  const panelTitle = title || (isEmailAgent ? 'Email Triage Agent' : 'Supervisor Agent');

  return (
    <div
      data-testid="chat-window"
      className="w-full md:w-[32%] lg:w-[30%] h-full flex flex-col bg-[#161b22] select-none"
    >
      {/* Pane Header */}
      <div className="h-10 border-b border-[#30363d] px-4 flex items-center justify-between bg-[#161b22] select-none">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span
            data-testid="chat-panel-title"
            className="text-xs font-semibold text-gray-300 tracking-wide uppercase"
          >
            {panelTitle}
          </span>
        </div>
      </div>

      {/* Message List */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 font-sans select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-2 select-none">
            <Bot className="w-10 h-10 text-gray-600 mb-1" />
            <p className="text-sm font-medium text-gray-400">
              {isEmailAgent ? 'Email Triage Agent Ready' : 'Supervisor Console Ready'}
            </p>
            <p className="text-xs text-gray-500 max-w-xs">
              {isEmailAgent
                ? 'Command the agent to triage emails, inspect candidate inquiries, or match projects. For example:'
                : 'Command the agent to mutate the project record. For example:'}
            </p>
            <div className="space-y-1.5 text-xs text-blue-400 text-left w-full mt-2">
              {isEmailAgent ? (
                <>
                  <button
                    onClick={() => setInputText('List all unassigned emails in inbox')}
                    className="w-full text-left p-2 rounded bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] transition-colors"
                  >
                    &quot;List all unassigned emails in inbox&quot;
                  </button>
                  <button
                    onClick={() => setInputText('Triage the currently selected email and suggest matching projects')}
                    className="w-full text-left p-2 rounded bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] transition-colors"
                  >
                    &quot;Triage the currently selected email and suggest matching projects&quot;
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setInputText('Change status to completed and add tag "reviewed"')}
                    className="w-full text-left p-2 rounded bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] transition-colors"
                  >
                    &quot;Change status to completed and add tag &apos;reviewed&apos;&quot;
                  </button>
                  <button
                    onClick={() => setInputText('Rename project to "Scriptorium Core Pipeline"')}
                    className="w-full text-left p-2 rounded bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] transition-colors"
                  >
                    &quot;Rename project to &apos;Scriptorium Core Pipeline&apos;&quot;
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1.5 text-[11px] text-gray-400 mb-1 px-1">
                {msg.sender === 'user' ? (
                  <>
                    <span className="font-semibold text-blue-300">Supervisor</span>
                    <User className="w-3 h-3 text-blue-400" />
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-purple-400" />
                    <span className="font-semibold text-purple-300">Agent</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[90%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#1c1836] text-gray-100 border border-purple-500/30 shadow-sm w-full'
                }`}
              >
                {/* File Attachment Chip */}
                {msg.fileAttachment && (
                  <div
                    data-testid="message-file-attachment"
                    className="flex items-center space-x-1.5 text-[11px] bg-blue-700/50 rounded px-2 py-1 mb-2 w-fit border border-blue-400/30"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-200" />
                    <span className="truncate max-w-[200px]" title={msg.fileAttachment.filename}>
                      {msg.fileAttachment.filename || 'Attached file'}
                    </span>
                  </div>
                )}

                {/* Embedded Tool Call Badges */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {msg.toolCalls.map((tc) => (
                      <ToolCallBadge key={tc.id} tool={tc} />
                    ))}
                  </div>
                )}

                {/* Text Content */}
                {msg.content ? (
                  <p className="whitespace-pre-wrap">
                    {msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, idx) =>
                      part.startsWith('**') && part.endsWith('**') ? (
                        <strong key={idx} className="font-semibold text-white">
                          {part.slice(2, -2)}
                        </strong>
                      ) : (
                        part
                      )
                    )}
                  </p>
                ) : (
                  msg.sender === 'agent' && isStreaming && (
                    <span className="inline-flex items-center space-x-1 text-purple-300 italic">
                      <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                      <span>{statusMessage || 'Processing...'}</span>
                    </span>
                  )
                )}
              </div>
            </div>
          ))
        )}


        {/* Error notification */}
        {errorText && (
          <div className="flex items-start space-x-2 text-xs text-red-300 bg-red-950/40 border border-red-800/40 p-3 rounded-md">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Execution Error</p>
              <p className="text-[11px] font-mono mt-0.5">{errorText}</p>
            </div>
          </div>
        )}
      </div>

      {/* Staged File Preview Chip */}
      {stagedFile && (
        <div
          data-testid="attached-file-chip"
          className="px-3 py-2 bg-[#0d1117] border-t border-[#30363d] flex items-center justify-between"
        >
          <div className="flex items-center space-x-2 text-xs text-gray-300 overflow-hidden">
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="truncate max-w-[200px] font-medium" title={stagedFile.file.name}>
              {stagedFile.file.name}
            </span>
            {stagedFile.uploading ? (
              <span className="flex items-center space-x-1 text-[11px] text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Uploading...</span>
              </span>
            ) : stagedFile.error ? (
              <span className="text-[11px] text-red-400">{stagedFile.error}</span>
            ) : (
              <span className="flex items-center space-x-1 text-[11px] text-green-400 font-medium">
                <Check className="w-3 h-3" />
                <span>Uploaded</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            data-testid="remove-file-btn"
            className="text-gray-400 hover:text-gray-200 p-1 rounded hover:bg-[#21262d] transition-colors"
            title="Remove attached file"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSend}
        className="p-3 border-t border-[#30363d] bg-[#161b22] flex items-center space-x-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="file-upload-input"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming}
          data-testid="file-upload-btn"
          className="bg-[#21262d] hover:bg-[#30363d] text-gray-300 p-2.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 border border-[#30363d]"
          title="Attach document"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Command the agent (e.g. set status to completed)..."
          disabled={isStreaming}
          data-testid="chat-input"
          className="flex-1 bg-[#0d1117] text-gray-100 placeholder-gray-500 text-xs px-3.5 py-2.5 rounded-md border border-[#30363d] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isStreaming || stagedFile?.uploading}
          data-testid="chat-send-btn"
          className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          title="Send command"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
};
