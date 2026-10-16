import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAddTag } from '../src/tools/executors';
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

describe('executeAddTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeAddTag_newTag_appendsTagArray_test', async () => {
    const result = await executeAddTag('pr-7k4x9q', { tag: 'reviewed' });

    expect(result.success).toBe(true);
    expect(result.data?.addedTag).toBe('reviewed');
    expect(db.collection).toHaveBeenCalledWith('projects');
  });
});
