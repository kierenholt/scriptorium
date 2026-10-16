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

export interface ToolCallExecution {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'calling' | 'executing' | 'success' | 'error';
  result?: unknown;
  error?: string;
}

export interface FileAttachment {
  uri: string;
  mimeType?: string;
  filename?: string;
}

export interface ChatMessageRecord {
  id: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  toolCalls?: ToolCallExecution[];
  fileAttachment?: FileAttachment;
  timestamp: string;
}

export interface FunctionLogEntry {
  id?: string;
  service: string;
  level: 'info' | 'warn' | 'error' | 'debug' | string;
  message: string;
  details?: Record<string, unknown> | null;
  timestamp: any;
  expireAt: Date;
  executionId?: string | null;
}

