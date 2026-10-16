import { searchVertexAI, indexVertexDocument } from '../vertexSearch';
import {
  ToolExecutionResult,
  CompactCandidateCard,
  SearchTalentArgs,
  IndexTalentArgs,
} from './types';

/**
 * Execute searchTalentPool tool against Vertex AI Search datastore.
 * Supports structured filters (minYearsExperience, vettedOnly) and maps
 * output to compact candidate profile cards to preserve LLM token context.
 */
export async function executeSearchTalentPool(
  _projectId: string,
  args: SearchTalentArgs
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
    if (
      args.minYearsExperience !== undefined &&
      typeof args.minYearsExperience === 'number' &&
      args.minYearsExperience > 0
    ) {
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
  args: IndexTalentArgs
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
export const executeSearchTalent = executeSearchTalentPool;
export const executeIndexTalentProfile = executeIndexTalentCv;
