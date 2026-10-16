import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firestore';
import { ProjectStatus } from '../types';
import { searchVertexAI, indexVertexDocument } from '../vertexSearch';


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

/**
 * Execute searchTalentPool tool against Vertex AI Search datastore.
 * Supports structured filters (minYearsExperience, vettedOnly) and maps
 * output to compact candidate profile cards to preserve LLM token context.
 */
export async function executeSearchTalentPool(
  _projectId: string,
  args: {
    query?: string;
    filter?: string;
    minYearsExperience?: number;
    vettedOnly?: boolean;
    pageSize?: number;
  }
): Promise<ToolExecutionResult> {
  if (!args.query || typeof args.query !== 'string' || args.query.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "query".',
      message: 'Failed to search talent pool: "query" parameter is required.',
    };
  }

  try {
    const filterClauses: string[] = [];
    if (args.filter && typeof args.filter === 'string' && args.filter.trim() !== '') {
      filterClauses.push(args.filter.trim());
    }
    if (args.minYearsExperience !== undefined && typeof args.minYearsExperience === 'number' && args.minYearsExperience > 0) {
      filterClauses.push(`years_experience >= ${args.minYearsExperience}`);
    }
    if (args.vettedOnly === true) {
      filterClauses.push(`vetted: ANY("true")`);
    }

    const constructedFilter = filterClauses.length > 0 ? filterClauses.join(' AND ') : undefined;
    const requestedPageSize =
      typeof args.pageSize === 'number' && args.pageSize > 0
        ? Math.min(args.pageSize, 10)
        : 5;

    const searchResponse = await searchVertexAI({
      query: args.query.trim(),
      filter: constructedFilter,
      pageSize: requestedPageSize,
    });

    const compactCandidates: CompactCandidateCard[] = searchResponse.results
      .slice(0, requestedPageSize)
      .map((doc) => ({
        id: doc.id,
        name: doc.name || 'Anonymous Candidate',
        role: doc.role,
        skills: doc.skills,
        location: doc.location,
        years_experience: doc.years_experience,
        vetted: doc.vetted,
        score: doc.score,
        documentLink: doc.documentLink,
      }));

    return {
      success: true,
      message: `Found ${compactCandidates.length} candidate(s) matching "${args.query.trim()}".`,
      data: {
        resultsCount: compactCandidates.length,
        candidates: compactCandidates,
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

/**
 * Execute indexTalentCv tool to register a new candidate CV / profile
 * directly into the Vertex AI Search datastore.
 */
export async function executeIndexTalentCv(
  _projectId: string,
  args: {
    name?: string;
    role?: string;
    skills?: string;
    location?: string;
    yearsExperience?: number;
    summary?: string;
    documentId?: string;
  }
): Promise<ToolExecutionResult> {
  if (!args.name || typeof args.name !== 'string' || args.name.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "name".',
      message: 'Failed to index talent profile: candidate "name" is required.',
    };
  }

  if (!args.role || typeof args.role !== 'string' || args.role.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "role".',
      message: 'Failed to index talent profile: candidate "role" is required.',
    };
  }

  if (!args.skills || typeof args.skills !== 'string' || args.skills.trim() === '') {
    return {
      success: false,
      error: 'Missing required parameter "skills".',
      message: 'Failed to index talent profile: candidate "skills" is required.',
    };
  }

  try {
    const indexResponse = await indexVertexDocument({
      name: args.name.trim(),
      role: args.role.trim(),
      skills: args.skills.trim(),
      location: args.location && typeof args.location === 'string' ? args.location.trim() : undefined,
      yearsExperience: typeof args.yearsExperience === 'number' ? args.yearsExperience : undefined,
      summary: args.summary && typeof args.summary === 'string' ? args.summary.trim() : undefined,
      documentId: args.documentId && typeof args.documentId === 'string' ? args.documentId.trim() : undefined,
    });

    return {
      success: true,
      message: indexResponse.message,
      data: {
        documentId: indexResponse.documentId,
        name: args.name.trim(),
        role: args.role.trim(),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error indexing talent document in Discovery Engine.',
      message: 'Failed to index talent profile into repository.',
    };
  }
}

// Domain-named function aliases
export const executeUpdateProjectLifecycleStage = executeUpdateStatus;
export const executeRenameProjectDocument = executeRenameProject;
export const executeUpdateProjectBriefDescription = executeUpdateDescription;
export const executeAddProjectRequirementTag = executeAddTag;
export const executeRemoveProjectRequirementTag = executeRemoveTag;
export const executeSearchTalent = executeSearchTalentPool;
export const executeIndexTalentProfile = executeIndexTalentCv;

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
    case 'searchTalent':
      return executeSearchTalentPool(
        projectId,
        args as {
          query?: string;
          filter?: string;
          minYearsExperience?: number;
          vettedOnly?: boolean;
          pageSize?: number;
        }
      );

    case 'indexTalentCv':
    case 'indexTalentProfile':
      return executeIndexTalentCv(
        projectId,
        args as {
          name?: string;
          role?: string;
          skills?: string;
          location?: string;
          yearsExperience?: number;
          summary?: string;
          documentId?: string;
        }
      );

    default:
      return {
        success: false,
        error: `Unknown tool "${toolName}".`,
        message: `Tool "${toolName}" is not recognized by Scriptorium.`,
      };
  }
}

