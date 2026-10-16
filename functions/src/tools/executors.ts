import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestore';
import { ProjectStatus } from '../types';
import { searchVertexAI } from '../vertexSearch';

const VALID_STATUSES: ProjectStatus[] = ['draft', 'in_progress', 'blocked', 'completed'];

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Execute updateProjectLifecycleStage tool (formerly updateStatus).
 */
export async function executeUpdateStatus(
  projectId: string,
  args: { status?: string }
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
  args: { title?: string }
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
  args: { description?: string }
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
  args: { tag?: string }
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
  args: { tag?: string }
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

/**
 * Execute searchTalentPool tool against Vertex AI Search datastore.
 */
export async function executeSearchTalentPool(
  _projectId: string,
  args: { query?: string; filter?: string; pageSize?: number }
): Promise<ToolExecutionResult> {
  if (!args.query || typeof args.query !== 'string' || args.query.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "query".',
      message: 'Failed to search talent pool: "query" parameter is required.',
    };
  }

  try {
    const searchResponse = await searchVertexAI({
      query: args.query.trim(),
      filter: args.filter && typeof args.filter === 'string' ? args.filter.trim() : undefined,
      pageSize: typeof args.pageSize === 'number' ? args.pageSize : undefined,
    });

    return {
      success: true,
      message: `Found ${searchResponse.results.length} candidate(s) matching "${args.query.trim()}".`,
      data: {
        resultsCount: searchResponse.results.length,
        candidates: searchResponse.results,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error querying Vertex AI Search talent datastore.',
      message: 'Failed to search talent pool.',
    };
  }
}

// Domain-named function aliases
export const executeUpdateProjectLifecycleStage = executeUpdateStatus;
export const executeRenameProjectDocument = executeRenameProject;
export const executeUpdateProjectBriefDescription = executeUpdateDescription;
export const executeAddProjectRequirementTag = executeAddTag;
export const executeRemoveProjectRequirementTag = executeRemoveTag;

/**
 * Tool dispatcher mapping domain-specific function names to executors.
 * Acts as the translation layer between agent tool calls and generic infrastructure mutations.
 */
export async function dispatchToolCall(
  projectId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'updateProjectLifecycleStage':
    case 'updateStatus':
      return executeUpdateStatus(projectId, args as { status?: string });

    case 'renameProjectDocument':
    case 'renameProject':
      return executeRenameProject(projectId, args as { title?: string });

    case 'updateProjectBriefDescription':
    case 'updateDescription':
      return executeUpdateDescription(projectId, args as { description?: string });

    case 'addProjectRequirementTag':
    case 'addTag':
      return executeAddTag(projectId, args as { tag?: string });

    case 'removeProjectRequirementTag':
    case 'removeTag':
      return executeRemoveTag(projectId, args as { tag?: string });

    case 'searchTalentPool':
      return executeSearchTalentPool(projectId, args as { query?: string; filter?: string; pageSize?: number });

    default:
      return {
        success: false,
        error: `Unknown tool "${toolName}".`,
        message: `Tool "${toolName}" is not recognized by Scriptorium.`,
      };
  }
}
