import { describe, it, expect, vi } from 'vitest';
import { executeIndexTalentCv } from '../src/tools/executors';
import * as vertexModule from '../src/vertexSearch';

describe('executeIndexTalentCv', () => {
  it('executeIndexTalentCv_validParameters_indexesCandidateDocument_test', async () => {
    const mockIndexResponse: vertexModule.IndexTalentCvResponse = {
      success: true,
      documentId: 'talent_marcus_smith_178500',
      message: 'Candidate "Marcus Smith" successfully indexed into Vertex AI datastore.',
    };

    const indexSpy = vi.spyOn(vertexModule, 'indexVertexDocument').mockResolvedValue(mockIndexResponse);

    const result = await executeIndexTalentCv('pr-7k4x9q', {
      name: 'Marcus Smith',
      role: 'German Transcreation Specialist',
      skills: 'German, Transcreation, Marketing Copy',
      location: 'Berlin, Germany',
      yearsExperience: 6,
      summary: 'Experienced German transcreation specialist focusing on automotive and technology brands.',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.documentId).toBe('talent_marcus_smith_178500');
    expect(result.data?.name).toBe('Marcus Smith');
    expect(result.data?.role).toBe('German Transcreation Specialist');

    expect(indexSpy).toHaveBeenCalledWith({
      name: 'Marcus Smith',
      role: 'German Transcreation Specialist',
      skills: 'German, Transcreation, Marketing Copy',
      location: 'Berlin, Germany',
      yearsExperience: 6,
      summary: 'Experienced German transcreation specialist focusing on automotive and technology brands.',
      documentId: undefined,
    });

    indexSpy.mockRestore();
  });

  it('executeIndexTalentCv_missingName_returnsExplicitError_test', async () => {
    const result = await executeIndexTalentCv('pr-7k4x9q', {
      name: '',
      role: 'Transcreation Specialist',
      skills: 'German, English',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter "name"');
  });

  it('executeIndexTalentCv_missingRole_returnsExplicitError_test', async () => {
    const result = await executeIndexTalentCv('pr-7k4x9q', {
      name: 'Marcus Smith',
      role: '',
      skills: 'German, English',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter "role"');
  });

  it('executeIndexTalentCv_missingSkills_returnsExplicitError_test', async () => {
    const result = await executeIndexTalentCv('pr-7k4x9q', {
      name: 'Marcus Smith',
      role: 'Transcreation Specialist',
      skills: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter "skills"');
  });

  it('executeIndexTalentCv_indexingThrowsError_returnsGracefulFailure_test', async () => {
    const indexSpy = vi.spyOn(vertexModule, 'indexVertexDocument').mockRejectedValue(
      new Error('Vertex AI document quota reached')
    );

    const result = await executeIndexTalentCv('pr-7k4x9q', {
      name: 'Marcus Smith',
      role: 'Transcreation Specialist',
      skills: 'German, English',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Vertex AI document quota reached');
    expect(result.message).toBe('Failed to index talent profile into repository.');

    indexSpy.mockRestore();
  });
});
