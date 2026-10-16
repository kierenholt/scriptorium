import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeUpdateStatus } from '../src/tools/executors';
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

describe('executeUpdateStatus invalid handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeUpdateStatus_invalidStatus_returnsExplicitError_test', async () => {
    const result = await executeUpdateStatus('pr-7k4x9q', { status: 'non_existent_status' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
    expect(db.collection).not.toHaveBeenCalled();
  });
});
