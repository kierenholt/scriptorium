import { ProjectStatus, ShortlistStatus } from '../types';

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface CompactCandidateCard {
  id: string;
  name: string;
  role?: string;
  skills?: string;
  location?: string;
  years_experience?: number;
  vetted?: boolean;
  score?: number;
  documentLink?: string;
}

export interface UpdateStatusArgs {
  status?: ProjectStatus | string;
}

export interface RenameProjectArgs {
  title?: string;
}

export interface UpdateDescriptionArgs {
  description?: string;
}

export interface ProjectTagArgs {
  tag?: string;
}

export interface SearchTalentArgs {
  query?: string;
  filter?: string;
  minYearsExperience?: number;
  vettedOnly?: boolean;
  pageSize?: number;
}

export interface IndexTalentArgs {
  name?: string;
  role?: string;
  skills?: string;
  location?: string;
  yearsExperience?: number;
  summary?: string;
  documentId?: string;
}

export interface ReadEmailArgs {
  query?: string;
  recipient?: string;
  sender?: string;
  emailId?: string;
}

export interface SendEmailArgs {
  to?: string;
  subject?: string;
  body?: string;
}

export interface SaveProjectArtifactArgs {
  sourceFileUri?: string;
  artifactName?: string;
  mimeType?: string;
  comment?: string;
}

export interface GetProjectArtifactDownloadUrlArgs {
  query?: string;
  artifactId?: string;
  comment?: string;
  expiresInMinutes?: number;
}

export interface LookupProjectRecordArgs {
  projectId?: string;
}

export interface ListRecentProjectsArgs {
  limit?: number;
}

export interface LookupProjectArtifactArgs {
  artifactId?: string;
  name?: string;
}

export interface GetProjectsFromEmailSenderArgs {
  senderEmail?: string;
}

export interface AssignEmailToProjectArgs {
  emailId?: string;
  projectId?: string;
}

export interface ListUnassignedInboxEmailsArgs {
  limit?: number;
}

export interface DeleteEmailArgs {
  emailId?: string;
}

export interface ShortlistCandidateArgs {
  name?: string;
  role?: string;
  talentId?: string;
  status?: ShortlistStatus | string;
  notes?: string;
  dayRate?: string | number;
}

export interface ListShortlistedTalentsArgs {
  status?: ShortlistStatus | string;
  limit?: number;
}

export interface UpdateShortlistedTalentStatusArgs {
  shortlistId?: string;
  status?: ShortlistStatus | string;
  notes?: string;
  dayRate?: string | number;
}

export interface RemoveShortlistedTalentArgs {
  shortlistId?: string;
}

export interface DeleteEmailArgs {
  emailId?: string;
}


