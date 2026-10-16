import { describe, it, expect } from 'vitest';
import { parseGcsUri } from '../src/storage';

describe('Storage Helpers Unit Tests', () => {
  it('parseGcsUri_validGcsUri_returnsBucketAndObjectPath_test', () => {
    const uri = 'gs://scriptorium-uploads-503507/uploads/123_test.txt';
    const result = parseGcsUri(uri);

    expect(result.bucket).toBe('scriptorium-uploads-503507');
    expect(result.objectPath).toBe('uploads/123_test.txt');
  });

  it('parseGcsUri_invalidScheme_throwsExplicitError_test', () => {
    expect(() => parseGcsUri('https://storage.googleapis.com/bucket/file.txt')).toThrow(
      /Must start with "gs:\/\/\"/
    );
  });

  it('parseGcsUri_emptyUri_throwsExplicitError_test', () => {
    expect(() => parseGcsUri('')).toThrow(/Invalid GCS URI/);
  });
});
