import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSaveProjectArtifact } from '../src/tools/projectExecutors';
import * as storageModule from '../src/storage';
import { db } from '../src/firestore';

vi.mock('../src/firestore', () => {
  const updateMock = vi.fn().mockResolvedValue({});
  const docMock = vi.fn(() => ({ update: updateMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  return {
    db: {
      collection: collectionMock,
    },
  };
});

describe('executeSaveProjectArtifact_validParameters_savesArtifactAndUpdatesProject_test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeSaveProjectArtifact_missingSourceUri_returnsExplicitError_test', async () => {
    const result = await executeSaveProjectArtifact('proj-123', {
      sourceFileUri: '',
      artifactName: 'Deliverable.pdf',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter "sourceFileUri"');
  });

  it('executeSaveProjectArtifact_invalidGcsUri_returnsExplicitError_test', async () => {
    const result = await executeSaveProjectArtifact('proj-123', {
      sourceFileUri: 'https://storage.googleapis.com/bucket/file.pdf',
      artifactName: 'Deliverable.pdf',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid GCS URI');
  });

  it('executeSaveProjectArtifact_missingArtifactName_returnsExplicitError_test', async () => {
    const result = await executeSaveProjectArtifact('proj-123', {
      sourceFileUri: 'gs://scriptorium-uploads-503507/uploads/file.pdf',
      artifactName: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter "artifactName"');
  });

  it('executeSaveProjectArtifact_validParameters_copiesToArtifactsAndUpdatesFirestore_test', async () => {
    const copySpy = vi.spyOn(storageModule, 'copyUploadedFileToProjectArtifacts').mockResolvedValue({
      uri: 'gs://scriptorium-project-artifacts-503507/projects/proj-123/Deliverable.pdf',
      size: 4096,
      mimeType: 'application/pdf',
    });

    const result = await executeSaveProjectArtifact('proj-123', {
      sourceFileUri: 'gs://scriptorium-uploads-503507/uploads/file.pdf',
      artifactName: 'Deliverable.pdf',
      mimeType: 'application/pdf',
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Deliverable.pdf');
    expect(copySpy).toHaveBeenCalledWith(
      'gs://scriptorium-uploads-503507/uploads/file.pdf',
      'proj-123',
      'Deliverable.pdf',
      'application/pdf'
    );

    const docMock = (db.collection as any)('projects').doc('proj-123');
    expect(docMock.update).toHaveBeenCalledTimes(1);
    const updateArg = docMock.update.mock.calls[0][0];
    expect(updateArg).toHaveProperty('artifacts');
    expect(updateArg).toHaveProperty('updatedAt');

    expect(result.data).toBeDefined();
    const artifact = (result.data as any).artifact;
    expect(artifact.name).toBe('Deliverable.pdf');
    expect(artifact.gcsUri).toBe('gs://scriptorium-project-artifacts-503507/projects/proj-123/Deliverable.pdf');
    expect(artifact.sourceGcsUri).toBe('gs://scriptorium-uploads-503507/uploads/file.pdf');
    expect(artifact.mimeType).toBe('application/pdf');
    expect(artifact.createdBy).toBe('agent');
  });

  it('executeSaveProjectArtifact_storageError_returnsExplicitError_test', async () => {
    vi.spyOn(storageModule, 'copyUploadedFileToProjectArtifacts').mockRejectedValue(
      new Error('Source file does not exist at "gs://scriptorium-uploads-503507/uploads/missing.pdf".')
    );

    const result = await executeSaveProjectArtifact('proj-123', {
      sourceFileUri: 'gs://scriptorium-uploads-503507/uploads/missing.pdf',
      artifactName: 'Missing.pdf',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Source file does not exist');
  });
});
