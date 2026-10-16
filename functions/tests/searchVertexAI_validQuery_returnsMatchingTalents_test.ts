import { describe, it, expect } from 'vitest';
import { searchVertexAI } from '../src/vertexSearch';

describe('searchVertexAI', () => {
  it('searchVertexAI_missingQuery_throwsFailFastError_test', async () => {
    await expect(searchVertexAI({ query: '' })).rejects.toThrow(
      '[FAIL FAST] Mandatory search parameter "query" must be a non-empty string.'
    );
  });

  it('searchVertexAI_validQuery_returnsMatchingTalents_test', async () => {
    // Query known candidate indexed in datastore (e.g. Business Analyst or Copywriter)
    const result = await searchVertexAI({
      query: 'Business Analyst',
      pageSize: 5,
    });

    expect(result.success).toBe(true);
    expect(result.query).toBe('Business Analyst');
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);

    const match = result.results[0];
    expect(match.id).toBeDefined();
    expect(match.name).toBeDefined();
    expect(match.role).toContain('Business Analyst');
  });
});
