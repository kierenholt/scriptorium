import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeLookupProjectRecord,
  executeListRecentProjects,
  executeLookupProjectArtifact,
} from '../src/tools/projectExecutors';
import { db } from '../src/firestore';

vi.mock('../src/firestore', () => {
  const getDocMock = vi.fn().mockImplementation(() => {
    return Promise.resolve({
      exists: true,
      data: () => ({
        id: 'pr-7k4x9q',
        title: 'Scriptorium Sample Project',
        description: 'Vetted pool project',
        status: 'in_progress',
        tags: ['transcreation', 'german'],
        artifacts: [
          {
            id: 'ar-8m2p9k',
            name: 'Campaign_Brief_v1.pdf',
            comment: 'Audited brief',
            gcsUri: 'gs://scriptorium-project-artifacts-503507/projects/pr-7k4x9q/Campaign_Brief_v1.pdf',
            mimeType: 'application/pdf',
            createdAt: '2026-10-16T12:00:00.000Z',
            createdBy: 'agent',
          },
        ],
        updatedAt: '2026-10-16T12:00:00.000Z',
      }),
    });
  });

  const docMock = vi.fn((id: string) => {
    if (id === 'pr-000000') {
      return { get: vi.fn().mockResolvedValue({ exists: false }) };
    }
    return { get: getDocMock };
  });

  const collectionMock = vi.fn(() => ({
    doc: docMock,
    orderBy: vi.fn(() => ({
      limit: vi.fn((count: number) => ({
        get: vi.fn().mockResolvedValue({
          docs: [
            {
              id: 'pr-7k4x9q',
              data: () => ({
                id: 'pr-7k4x9q',
                title: 'Scriptorium Sample Project',
                status: 'in_progress',
                tags: ['transcreation'],
                artifacts: [{ id: 'ar-8m2p9k' }],
                updatedAt: '2026-10-16T12:00:00.000Z',
              }),
            },
          ],
        }),
      })),
    })),
  }));

  return {
    db: {
      collection: collectionMock,
    },
  };
});

describe('executeLookupTools_validParameters_retrievesProjectAndArtifactRecords_test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeLookupProjectRecord_validProjectId_returnsProjectDocument_test', async () => {
    const result = await executeLookupProjectRecord('pr-7k4x9q', { projectId: 'pr-7k4x9q' });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect((result.data?.project as any).id).toBe('pr-7k4x9q');
    expect((result.data?.project as any).title).toBe('Scriptorium Sample Project');
  });

  it('executeLookupProjectRecord_invalidEntityId_returnsExplicitError_test', async () => {
    const result = await executeLookupProjectRecord('pr-7k4x9q', { projectId: 'invalid-id' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid entity ID "invalid-id"');
  });

  it('executeLookupProjectRecord_nonExistentProject_returnsExplicitFailure_test', async () => {
    const result = await executeLookupProjectRecord('pr-7k4x9q', { projectId: 'pr-000000' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('executeListRecentProjects_validLimit_returnsProjectsList_test', async () => {
    const result = await executeListRecentProjects('pr-7k4x9q', { limit: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.count).toBe(1);
    const projects = result.data?.projects as any[];
    expect(projects[0].id).toBe('pr-7k4x9q');
    expect(projects[0].status).toBe('in_progress');
  });

  it('executeLookupProjectArtifact_validArtifactId_returnsArtifactRecord_test', async () => {
    const result = await executeLookupProjectArtifact('pr-7k4x9q', { artifactId: 'ar-8m2p9k' });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const artifact = result.data?.artifact as any;
    expect(artifact.id).toBe('ar-8m2p9k');
    expect(artifact.name).toBe('Campaign_Brief_v1.pdf');
  });

  it('executeLookupProjectArtifact_missingParams_returnsExplicitError_test', async () => {
    const result = await executeLookupProjectArtifact('pr-7k4x9q', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('At least one of "artifactId" or "name" must be specified');
  });
});
