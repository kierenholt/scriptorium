export type ProjectStatus = 'draft' | 'in_progress' | 'blocked' | 'completed';

export interface ProjectArtifact {
  id: string;
  name: string;
  gcsUri: string;
  sourceGcsUri?: string;
  mimeType: string;
  comment?: string;
  createdAt: string;
  createdBy: string;
}

export interface ProjectEmail {
  id: string;
  resendId?: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string | string[];
  subject: string;
  body: string;
  timestamp: string;
  assignedAt?: string;
  projectId?: string;
}

export interface ProjectDocument {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  tags: string[];
  artifacts?: ProjectArtifact[];
  emails?: ProjectEmail[];
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

export interface FileAttachment {
  uri: string;
  mimeType?: string;
  filename?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  toolCalls?: ToolCallItem[];
  fileAttachment?: FileAttachment;
  timestamp: string;
}
