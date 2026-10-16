import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestore';
import { ProjectStatus } from '../types';

const VALID_STATUSES: ProjectStatus[] = ['draft', 'in_progress', 'blocked', 'completed'];

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Execute updateStatus tool.
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
 * Execute renameProject tool.
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
 * Execute updateDescription tool.
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
 * Execute addTag tool.
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
 * Execute removeTag tool.
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
 * Tool dispatcher mapping function names to executors.
 */
export async function dispatchToolCall(
  projectId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'updateStatus':
      return executeUpdateStatus(projectId, args as { status?: string });
    case 'renameProject':
      return executeRenameProject(projectId, args as { title?: string });
    case 'updateDescription':
      return executeUpdateDescription(projectId, args as { description?: string });
    case 'addTag':
      return executeAddTag(projectId, args as { tag?: string });
    case 'removeTag':
      return executeRemoveTag(projectId, args as { tag?: string });
    default:
      return {
        success: false,
        error: `Unknown tool "${toolName}".`,
        message: `Tool "${toolName}" is not recognized by Scriptorium.`,
      };
  }
}
