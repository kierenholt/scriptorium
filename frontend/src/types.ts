export type ProjectStatus = 'draft' | 'in_progress' | 'blocked' | 'completed';

export interface ProjectDocument {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string>;
}

export type ToolStatus = 'calling' | 'executing' | 'success' | 'error';

export interface ToolCallItem {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
  error?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  toolCalls?: ToolCallItem[];
  timestamp: string;
}
