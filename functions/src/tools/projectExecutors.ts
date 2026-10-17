import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestore';
import { ProjectStatus, ProjectArtifact, ProjectDocument } from '../types';
import { copyUploadedFileToProjectArtifacts } from '../storage';
import { buildArtifactDownloadUrl } from '../artifactTokens';
import { serverConfig } from '../config';
import { generateEntityId, assertValidEntityId } from '../entityId';
import {
  ToolExecutionResult,
  UpdateStatusArgs,
  RenameProjectArgs,
  UpdateDescriptionArgs,
  ProjectTagArgs,
  SaveProjectArtifactArgs,
  GetProjectArtifactDownloadUrlArgs,
  LookupProjectRecordArgs,
  ListRecentProjectsArgs,
  LookupProjectArtifactArgs,
} from './types';

export const VALID_STATUSES: ProjectStatus[] = ['draft', 'in_progress', 'blocked', 'completed'];

/**
 * Execute updateProjectLifecycleStage tool (formerly updateStatus).
 */
export async function executeUpdateStatus(
  projectId: string,
  args: UpdateStatusArgs
): Promise<ToolExecutionResult> {
  if (!args.status) {
    return {
      success: false,
      error: 'Missing required parameter "status".',
      message: 'Failed to update status: parameter "status" is required.',
    };
  }

  const status = args.status as ProjectStatus;
  if (!VALID_STATUSES.includes(status)) {
    return {
      success: false,
      error: `Invalid status "${status}". Allowed values: ${VALID_STATUSES.join(', ')}.`,
      message: `Status must be one of: ${VALID_STATUSES.join(', ')}.`,
    };
  }

  const now = new Date().toISOString();
  await db.collection('projects').doc(projectId).update({
    status,
    updatedAt: now,
  });

  return {
    success: true,
    message: `Project status successfully updated to "${status}".`,
    data: { status, updatedAt: now },
  };
}

/**
 * Execute renameProjectDocument tool (formerly renameProject).
 */
export async function executeRenameProject(
  projectId: string,
  args: RenameProjectArgs
): Promise<ToolExecutionResult> {
  if (!args.title || args.title.trim() === '') {
    return {
      success: false,
      error: 'Missing or empty required parameter "title".',
      message: 'Failed to rename project: title cannot be empty.',
    };
  }

  const title = args.title.trim();
  const now = new Date().toISOString();
  await db.collection('projects').doc(projectId).update({
    title,
    updatedAt: now,
  });

  return {
    success: true,
    message: `Project title successfully updated to "${title}".`,
    data: { title, updatedAt: now },
  };
}

/**
 * Execute updateProjectBriefDescription tool (formerly updateDescription).
 */
export async function executeUpdateDescription(
  projectId: string,
  args: UpdateDescriptionArgs
): Promise<ToolExecutionResult> {
  if (typeof args.description !== 'string') {
    return {
      success: false,
      error: 'Missing required parameter "description".',
      message: 'Failed to update description: "description" parameter must be a string.',
    };
  }

  const description = args.description.trim();
  const now = new Date().toISOString();
  await db.collection('projects').doc(projectId).update({
    description,
    updatedAt: now,
  });

  return {
    success: true,
    message: 'Project description successfully updated.',
    data: { description, updatedAt: now },
  };
}

/**
 * Execute addProjectRequirementTag tool (formerly addTag).
 */
export async function executeAddTag(
  projectId: string,
  args: ProjectTagArgs
): Promise<ToolExecutionResult> {
  if (!args.tag || args.tag.trim() === '') {
    return {
      success: false,
      error: 'Missing or empty required parameter "tag".',
      message: 'Failed to add tag: tag cannot be empty.',
    };
  }

  const tag = args.tag.trim().toLowerCase();
  const now = new Date().toISOString();
  await db.collection('projects').doc(projectId).update({
    tags: FieldValue.arrayUnion(tag),
    updatedAt: now,
  });

  return {
    success: true,
    message: `Tag "${tag}" successfully added to project.`,
    data: { addedTag: tag, updatedAt: now },
  };
}

/**
 * Execute removeProjectRequirementTag tool (formerly removeTag).
 */
export async function executeRemoveTag(
  projectId: string,
  args: ProjectTagArgs
): Promise<ToolExecutionResult> {
  if (!args.tag || args.tag.trim() === '') {
    return {
      success: false,
      error: 'Missing or empty required parameter "tag".',
      message: 'Failed to remove tag: tag cannot be empty.',
    };
  }

  const tag = args.tag.trim().toLowerCase();
  const now = new Date().toISOString();
  await db.collection('projects').doc(projectId).update({
    tags: FieldValue.arrayRemove(tag),
    updatedAt: now,
  });

  return {
    success: true,
    message: `Tag "${tag}" successfully removed from project.`,
    data: { removedTag: tag, updatedAt: now },
  };
}

// Domain-named function aliases
export const executeUpdateProjectLifecycleStage = executeUpdateStatus;
export const executeRenameProjectDocument = executeRenameProject;
export const executeUpdateProjectBriefDescription = executeUpdateDescription;
export const executeAddProjectRequirementTag = executeAddTag;
export const executeRemoveProjectRequirementTag = executeRemoveTag;

/**
 * Execute saveProjectArtifact tool.
 * Promotes an uploaded file to the permanent project artifacts bucket and registers it in Firestore.
 */
export async function executeSaveProjectArtifact(
  projectId: string,
  args: SaveProjectArtifactArgs
): Promise<ToolExecutionResult> {
  if (!args.sourceFileUri || args.sourceFileUri.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "sourceFileUri".',
      message: 'Failed to save artifact: "sourceFileUri" is required.',
    };
  }
  if (!args.sourceFileUri.startsWith('gs://')) {
    return {
      success: false,
      error: `Invalid GCS URI "${args.sourceFileUri}". Must begin with "gs://".`,
      message: 'Failed to save artifact: sourceFileUri must be a valid gs:// URI.',
    };
  }
  if (!args.artifactName || args.artifactName.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "artifactName".',
      message: 'Failed to save artifact: "artifactName" is required.',
    };
  }

  try {
    const copied = await copyUploadedFileToProjectArtifacts(
      args.sourceFileUri.trim(),
      projectId,
      args.artifactName.trim(),
      args.mimeType
    );

    const artifact: ProjectArtifact = {
      id: generateEntityId('ar'),
      name: args.artifactName.trim(),
      gcsUri: copied.uri,
      sourceGcsUri: args.sourceFileUri.trim(),
      mimeType: copied.mimeType,
      createdAt: new Date().toISOString(),
      createdBy: 'agent',
    };

    if (args.comment && args.comment.trim() !== '') {
      artifact.comment = args.comment.trim();
    }

    const now = new Date().toISOString();
    await db.collection('projects').doc(projectId).update({
      artifacts: FieldValue.arrayUnion(artifact),
      updatedAt: now,
    });

    return {
      success: true,
      message: `Artifact "${artifact.name}" successfully saved to project artifacts repository.`,
      data: { artifact, updatedAt: now },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error occurred while saving project artifact.',
      message: `Failed to save artifact: ${error.message || 'Unknown error.'}`,
    };
  }
}

export const executeSaveArtifact = executeSaveProjectArtifact;
export const executeAttachProjectDeliverable = executeSaveProjectArtifact;

/**
 * Shared helper to load a project and search its artifacts array by criteria.
 */
export async function findArtifactInProject(
  projectId: string,
  criteria: {
    artifactId?: string;
    name?: string;
    comment?: string;
    query?: string;
  }
): Promise<{
  projectExists: boolean;
  artifactsPresent: boolean;
  artifact?: ProjectArtifact;
}> {
  const docSnap = await db.collection('projects').doc(projectId).get();
  if (!docSnap.exists) {
    return { projectExists: false, artifactsPresent: false };
  }

  const projectData = docSnap.data() as ProjectDocument;
  const artifacts: ProjectArtifact[] = projectData.artifacts || [];
  if (artifacts.length === 0) {
    return { projectExists: true, artifactsPresent: false };
  }

  let matched: ProjectArtifact | undefined;

  // 1. Direct artifactId exact match
  if (criteria.artifactId) {
    const idTrim = criteria.artifactId.trim().toLowerCase();
    matched = artifacts.find((a) => a.id.toLowerCase() === idTrim);
  }

  // 2. Direct name match (substring or exact)
  if (!matched && criteria.name) {
    const nameTrim = criteria.name.trim().toLowerCase();
    matched = artifacts.find((a) => a.name.toLowerCase().includes(nameTrim));
  }

  // 3. Direct comment match
  if (!matched && criteria.comment) {
    const commentTrim = criteria.comment.trim().toLowerCase();
    matched = artifacts.find((a) => a.comment && a.comment.toLowerCase().includes(commentTrim));
  }

  // 4. Query term match across ID, name, or comment
  if (!matched && criteria.query) {
    const queryTrim = criteria.query.trim().toLowerCase();
    matched = artifacts.find((a) => {
      const idMatch = a.id.toLowerCase() === queryTrim;
      const nameMatch = a.name.toLowerCase().includes(queryTrim);
      const commentMatch = a.comment && a.comment.toLowerCase().includes(queryTrim);
      return idMatch || nameMatch || commentMatch;
    });
  }

  return {
    projectExists: true,
    artifactsPresent: true,
    artifact: matched,
  };
}

/**
 * Execute getProjectArtifactDownloadUrl tool.
 * Searches project artifacts by ID, filename, or comment keyword, and generates a timeboxed secure download URL.
 */
export async function executeGetProjectArtifactDownloadUrl(
  projectId: string,
  args: GetProjectArtifactDownloadUrlArgs
): Promise<ToolExecutionResult> {
  const searchTerm = (args.query || args.artifactId || args.comment || '').trim();
  if (!searchTerm) {
    return {
      success: false,
      error: 'Missing required search criteria (query, artifactId, or comment).',
      message: 'Failed to retrieve artifact: search criteria cannot be empty.',
    };
  }

  const lookup = await findArtifactInProject(projectId, {
    artifactId: args.artifactId,
    comment: args.comment,
    query: searchTerm,
  });

  if (!lookup.projectExists) {
    return {
      success: false,
      error: `Project "${projectId}" not found.`,
      message: `Failed to retrieve artifact: project "${projectId}" does not exist.`,
    };
  }

  if (!lookup.artifactsPresent) {
    return {
      success: false,
      error: `No artifacts exist for project "${projectId}".`,
      message: 'This project currently has no saved artifacts.',
    };
  }

  if (!lookup.artifact) {
    return {
      success: false,
      error: `No artifact found matching "${searchTerm}".`,
      message: `Could not find any artifact in project "${projectId}" matching "${searchTerm}".`,
    };
  }

  const matched = lookup.artifact;
  const expiryMinutes = args.expiresInMinutes || 15;
  const { url, expiresAt } = buildArtifactDownloadUrl(
    serverConfig.functionsBaseUrl,
    projectId,
    matched.id,
    expiryMinutes
  );

  return {
    success: true,
    message: `Secure timeboxed download URL generated for "${matched.name}". Valid for ${expiryMinutes} minutes (expires at ${expiresAt}). [Download Document](${url})\n${url}`,
    data: {
      artifact: matched,
      downloadUrl: url,
      expiresAt,
    },
  };
}

export const executeGetArtifactDownloadUrl = executeGetProjectArtifactDownloadUrl;
export const executeRetrieveProjectArtifact = executeGetProjectArtifactDownloadUrl;

/**
 * Execute lookupProjectRecord tool.
 * Look up a Scriptorium project document by its project ID (e.g. "pr-7k4x9q").
 */
export async function executeLookupProjectRecord(
  projectId: string,
  args: LookupProjectRecordArgs
): Promise<ToolExecutionResult> {
  const targetId = args.projectId && args.projectId.trim() !== '' ? args.projectId.trim() : projectId;
  if (!targetId) {
    return {
      success: false,
      error: 'Missing required parameter "projectId".',
      message: 'Failed to look up project: parameter "projectId" is required.',
    };
  }

  try {
    assertValidEntityId(targetId, 'pr');
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      message: `Failed to look up project: ${err.message}`,
    };
  }

  const docSnap = await db.collection('projects').doc(targetId).get();
  if (!docSnap.exists) {
    return {
      success: false,
      error: `Project document with ID "${targetId}" does not exist in Firestore.`,
      message: `Could not find any project with ID "${targetId}".`,
    };
  }

  const data = docSnap.data() as ProjectDocument;
  return {
    success: true,
    message: `Project "${data.title}" (${targetId}) located: status "${data.status}", ${data.tags?.length || 0} requirement tag(s), ${data.artifacts?.length || 0} artifact(s).`,
    data: {
      projectId: targetId,
      project: data,
    },
  };
}

/**
 * Execute listRecentProjects tool.
 * Lists recent projects with IDs, titles, status, and tags.
 */
export async function executeListRecentProjects(
  _projectId: string,
  args: ListRecentProjectsArgs
): Promise<ToolExecutionResult> {
  const limitCount = Math.min(Math.max(args.limit || 10, 1), 50);

  try {
    const snap = await db.collection('projects').orderBy('updatedAt', 'desc').limit(limitCount).get();
    const projects = snap.docs.map((doc) => {
      const d = doc.data() as ProjectDocument;
      return {
        id: doc.id,
        title: d.title || 'Untitled Project',
        status: d.status || 'draft',
        tags: d.tags || [],
        artifactCount: d.artifacts?.length || 0,
        updatedAt: d.updatedAt,
      };
    });

    return {
      success: true,
      message: `Retrieved ${projects.length} recent project(s).`,
      data: {
        projects,
        count: projects.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error listing recent projects from Firestore.',
      message: `Failed to list projects: ${err.message || 'Unknown error.'}`,
    };
  }
}

/**
 * Execute lookupProjectArtifact tool.
 * Look up artifact metadata within the current project by artifactId (ar-xxxxxx) or name.
 */
export async function executeLookupProjectArtifact(
  projectId: string,
  args: LookupProjectArtifactArgs
): Promise<ToolExecutionResult> {
  if (!args.artifactId && !args.name) {
    return {
      success: false,
      error: 'At least one of "artifactId" or "name" must be specified to look up an artifact.',
      message: 'Failed to look up artifact: please specify "artifactId" or "name".',
    };
  }

  const lookup = await findArtifactInProject(projectId, {
    artifactId: args.artifactId,
    name: args.name,
  });

  if (!lookup.projectExists) {
    return {
      success: false,
      error: `Project "${projectId}" does not exist.`,
      message: `Cannot look up artifact: project "${projectId}" not found.`,
    };
  }

  if (!lookup.artifact) {
    return {
      success: false,
      error: 'No artifact found matching criteria.',
      message: `Could not find any artifact in project "${projectId}" matching the query.`,
    };
  }

  const matched = lookup.artifact;
  return {
    success: true,
    message: `Artifact "${matched.name}" (${matched.id}) found in project repository.`,
    data: {
      artifact: matched,
    },
  };
}


