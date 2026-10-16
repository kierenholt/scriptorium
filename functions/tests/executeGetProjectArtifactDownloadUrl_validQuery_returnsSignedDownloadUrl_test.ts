import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGetProjectArtifactDownloadUrl } from '../src/tools/projectExecutors';
import { verifyArtifactDownloadToken } from '../src/artifactTokens';
import { db } from '../src/firestore';

vi.mock('../src/firestore', () => {
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  return {
    db: {
      collection: collectionMock,
    },
  };
});

describe('executeGetProjectArtifactDownloadUrl_validQuery_returnsSignedDownloadUrl_test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeGetProjectArtifactDownloadUrl_missingQuery_returnsExplicitError_test', async () => {
    const result = await executeGetProjectArtifactDownloadUrl('proj-123', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required search criteria');
  });

  it('executeGetProjectArtifactDownloadUrl_projectNotFound_returnsExplicitError_test', async () => {
    const docMock = (db.collection as any)('projects').doc('proj-123');
    docMock.get.mockResolvedValue({ exists: false });

    const result = await executeGetProjectArtifactDownloadUrl('proj-123', { query: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Project "proj-123" not found');
  });

  it('executeGetProjectArtifactDownloadUrl_matchesCommentKeyword_returnsDownloadUrlAndVerifies_test', async () => {
    const docMock = (db.collection as any)('projects').doc('proj-123');
    docMock.get.mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'proj-123',
        artifacts: [
          {
            id: 'art-brief-999',
            name: 'Campaign_Brief.pdf',
            gcsUri: 'gs://scriptorium-project-artifacts-503507/projects/proj-123/Campaign_Brief.pdf',
            mimeType: 'application/pdf',
            comment: 'Deliverable audit dossier for token 87654321',
            createdAt: '2026-10-16T12:00:00.000Z',
            createdBy: 'agent',
          },
        ],
      }),
    });

    const result = await executeGetProjectArtifactDownloadUrl('proj-123', {
      query: 'token 87654321',
      expiresInMinutes: 15,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const downloadUrl = (result.data as any).downloadUrl as string;
    expect(downloadUrl).toContain('/downloadArtifact?');
    expect(downloadUrl).toContain('projectId=proj-123');
    expect(downloadUrl).toContain('artifactId=art-brief-999');
    expect(downloadUrl).toContain('signature=');

    // Parse URL and verify HMAC token
    const parsedUrl = new URL(downloadUrl);
    const projectId = parsedUrl.searchParams.get('projectId')!;
    const artifactId = parsedUrl.searchParams.get('artifactId')!;
    const expires = Number(parsedUrl.searchParams.get('expires'));
    const signature = parsedUrl.searchParams.get('signature')!;

    const verification = verifyArtifactDownloadToken(projectId, artifactId, expires, signature);
    expect(verification.valid).toBe(true);

    // Tampered signature must fail
    const tamperedVerification = verifyArtifactDownloadToken(projectId, artifactId, expires, signature.replace('a', 'b'));
    expect(tamperedVerification.valid).toBe(false);
  });
});
