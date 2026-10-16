import { describe, it, expect, vi } from 'vitest';
import { executeSearchTalentPool } from '../src/tools/executors';
import * as vertexModule from '../src/vertexSearch';

describe('executeSearchTalentPool', () => {
  it('executeSearchTalentPool_validParameters_returnsCompactCandidates_test', async () => {
    const mockSearchResults: vertexModule.SearchTalentResponse = {
      success: true,
      query: 'copywriter',
      results: [
        {
          id: 'talent-1',
          name: 'Jane Doe',
          role: 'Senior Copywriter',
          skills: 'Copywriting, Brand Voice',
          location: 'London, UK',
          years_experience: 7,
          vetted: true,
          score: 0.94,
          documentLink: 'gs://scriptorium-searchable/cvs/jane_doe.pdf',
          rawInternalExtraField: 'should_not_pollute_compact_card',
        },
      ],
    };

    const searchSpy = vi.spyOn(vertexModule, 'searchVertexAI').mockResolvedValue(mockSearchResults);

    const result = await executeSearchTalentPool('pr-7k4x9q', {
      query: 'copywriter',
      minYearsExperience: 5,
      vettedOnly: true,
      pageSize: 5,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.resultsCount).toBe(1);

    const candidates = result.data?.candidates as any[];
    expect(candidates).toHaveLength(1);

    const candidate = candidates[0];
    expect(candidate.id).toBe('talent-1');
    expect(candidate.name).toBe('Jane Doe');
    expect(candidate.role).toBe('Senior Copywriter');
    expect(candidate.years_experience).toBe(7);
    expect(candidate.vetted).toBe(true);
    expect(candidate.score).toBe(0.94);
    expect(candidate.documentLink).toBe('gs://scriptorium-searchable/cvs/jane_doe.pdf');

    // Verify filter construction in searchVertexAI call
    expect(searchSpy).toHaveBeenCalledWith({
      query: 'copywriter',
      filter: 'years_experience >= 5 AND vetted: ANY("true")',
      pageSize: 5,
    });

    searchSpy.mockRestore();
  });

  it('executeSearchTalentPool_missingQuery_returnsExplicitError_test', async () => {
    const result = await executeSearchTalentPool('pr-7k4x9q', {
      query: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter "query"');
    expect(result.message).toContain('"query" parameter is required');
  });

  it('executeSearchTalentPool_searchThrowsError_returnsGracefulFailure_test', async () => {
    const searchSpy = vi.spyOn(vertexModule, 'searchVertexAI').mockRejectedValue(
      new Error('Discovery Engine rate limit exceeded')
    );

    const result = await executeSearchTalentPool('pr-7k4x9q', {
      query: 'transcreation specialist',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Discovery Engine rate limit exceeded');
    expect(result.message).toBe('Failed to search talent pool.');

    searchSpy.mockRestore();
  });
});
