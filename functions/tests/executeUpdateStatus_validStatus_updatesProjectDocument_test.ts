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

describe('executeUpdateStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeUpdateStatus_validStatus_updatesProjectDocument_test', async () => {
    const result = await executeUpdateStatus('project-default', { status: 'completed' });

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('completed');
    expect(db.collection).toHaveBeenCalledWith('projects');
  });
});
