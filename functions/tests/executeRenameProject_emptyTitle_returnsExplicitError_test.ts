import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRenameProject } from '../src/tools/executors';
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

describe('executeRenameProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeRenameProject_emptyTitle_returnsExplicitError_test', async () => {
    const result = await executeRenameProject('project-default', { title: '   ' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing or empty');
    expect(db.collection).not.toHaveBeenCalled();
  });
});
