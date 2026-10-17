import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeShortlistCandidate,
  executeListShortlistedTalents,
  executeUpdateShortlistedTalentStatus,
  executeRemoveShortlistedTalent,
  VALID_SHORTLIST_STATUSES,
} from '../src/tools/shortlistExecutors';
import { isValidEntityId } from '../src/entityId';

// Setup Mock Firestore
const setMock = vi.fn().mockResolvedValue({});
const updateMock = vi.fn().mockResolvedValue({});
const deleteMock = vi.fn().mockResolvedValue({});
let existingShortlistDoc: any = null;

const subDocMock = vi.fn((docId: string) => ({
  set: setMock,
  update: updateMock,
  delete: deleteMock,
  get: vi.fn().mockImplementation(() =>
    Promise.resolve(
      existingShortlistDoc
        ? {
            exists: true,
            id: docId,
            data: () => ({ ...existingShortlistDoc, id: docId }),
          }
        : { exists: false, id: docId, data: () => null }
    )
  ),
}));

const subCollectionMock = vi.fn(() => ({
  doc: subDocMock,
  where: vi.fn(() => ({
    limit: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        docs: [
          {
            id: 'sl-111111',
            data: () => ({
              id: 'sl-111111',
              name: 'Elena Rostova',
              role: 'Transcreation Lead',
              status: 'shortlisted',
            }),
          },
        ],
        forEach: vi.fn((cb) => {
          cb({
            id: 'sl-111111',
            data: () => ({
              id: 'sl-111111',
              name: 'Elena Rostova',
              role: 'Transcreation Lead',
              status: 'shortlisted',
            }),
          });
        }),
      }),
    })),
  })),
  limit: vi.fn(() => ({
    get: vi.fn().mockResolvedValue({
      docs: [
        {
          id: 'sl-111111',
          data: () => ({
            id: 'sl-111111',
            name: 'Elena Rostova',
            role: 'Transcreation Lead',
            status: 'shortlisted',
          }),
        },
      ],
      forEach: vi.fn((cb) => {
        cb({
          id: 'sl-111111',
          data: () => ({
            id: 'sl-111111',
            name: 'Elena Rostova',
            role: 'Transcreation Lead',
            status: 'shortlisted',
          }),
        });
      }),
    }),
  })),
}));

const projectDocMock = vi.fn((projId: string) => ({
  update: updateMock,
  get: vi.fn().mockResolvedValue({
    exists: projId !== 'pr-nonexistent',
    id: projId,
    data: () => ({ id: projId, title: 'Test Project' }),
  }),
  collection: subCollectionMock,
}));

vi.mock('../src/firestore', () => ({
  db: {
    collection: vi.fn((colName: string) => {
      if (colName === 'projects') {
        return {
          doc: projectDocMock,
        };
      }
      return {};
    }),
  },
}));

describe('executeShortlistExecutors_validAndInvalidOperations_managesProjectShortlist_test', () => {
  const TEST_PROJECT_ID = 'pr-7k4x9q';

  beforeEach(() => {
    vi.clearAllMocks();
    existingShortlistDoc = {
      id: 'sl-123456',
      name: 'Sarah Connor',
      role: 'Creative Producer',
      status: 'shortlisted',
      dayRate: '£500',
      createdAt: '2026-10-17T10:00:00.000Z',
      updatedAt: '2026-10-17T10:00:00.000Z',
    };
  });

  it('executeShortlistCandidate_missingOrInvalidParams_returnsExplicitError_test', async () => {
    // 1. Missing projectId
    const noProj = await executeShortlistCandidate('', { name: 'Alice', role: 'Writer' });
    expect(noProj.success).toBe(false);
    expect(noProj.error).toMatch(/Missing required projectId/);

    // 2. Missing name
    const noName = await executeShortlistCandidate(TEST_PROJECT_ID, { role: 'Writer' });
    expect(noName.success).toBe(false);
    expect(noName.error).toMatch(/Missing required parameter "name"/);

    // 3. Missing role
    const noRole = await executeShortlistCandidate(TEST_PROJECT_ID, { name: 'Alice' });
    expect(noRole.success).toBe(false);
    expect(noRole.error).toMatch(/Missing required parameter "role"/);

    // 4. Invalid status
    const badStatus = await executeShortlistCandidate(TEST_PROJECT_ID, {
      name: 'Alice',
      role: 'Writer',
      status: 'invalid_status' as any,
    });
    expect(badStatus.success).toBe(false);
    expect(badStatus.error).toMatch(/Invalid status "invalid_status"/);

    // 5. Non-existent project
    const nonExistent = await executeShortlistCandidate('pr-nonexistent', {
      name: 'Alice',
      role: 'Writer',
    });
    expect(nonExistent.success).toBe(false);
    expect(nonExistent.error).toMatch(/Project "pr-nonexistent" not found/);
  });

  it('executeShortlistCandidate_validParams_createsShortlistDocAndUpdatesProject_test', async () => {
    const result = await executeShortlistCandidate(TEST_PROJECT_ID, {
      name: 'Marcus Vance',
      role: 'German Transcreation Lead',
      talentId: 'tl-9k2a4x',
      status: 'nominated',
      dayRate: '£480',
      notes: 'Strong portfolio in luxury automotive.',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const data = result.data as any;
    expect(isValidEntityId(data.id, 'sl')).toBe(true);
    expect(data.name).toBe('Marcus Vance');
    expect(data.role).toBe('German Transcreation Lead');
    expect(data.talentId).toBe('tl-9k2a4x');
    expect(data.status).toBe('nominated');
    expect(data.dayRate).toBe('£480');
    expect(data.notes).toBe('Strong portfolio in luxury automotive.');
    expect(data.createdAt).toBeDefined();

    // Verify subcollection set and project update called
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('executeListShortlistedTalents_validProject_retrievesShortlist_test', async () => {
    const listResult = await executeListShortlistedTalents(TEST_PROJECT_ID, {
      status: 'shortlisted',
    });

    expect(listResult.success).toBe(true);
    expect(listResult.data).toBeDefined();
    const data = listResult.data as any;
    expect(data.count).toBe(1);
    expect(data.shortlistedTalents).toHaveLength(1);
    expect(data.shortlistedTalents[0].name).toBe('Elena Rostova');
  });

  it('executeUpdateShortlistedTalentStatus_missingOrInvalidParams_returnsExplicitError_test', async () => {
    // 1. Missing shortlistId
    const noId = await executeUpdateShortlistedTalentStatus(TEST_PROJECT_ID, { status: 'booked' });
    expect(noId.success).toBe(false);
    expect(noId.error).toMatch(/Missing required parameter "shortlistId"/);

    // 2. Malformed entity ID
    const badId = await executeUpdateShortlistedTalentStatus(TEST_PROJECT_ID, {
      shortlistId: 'invalid-id',
      status: 'booked',
    });
    expect(badId.success).toBe(false);
    expect(badId.error).toMatch(/\[FAIL FAST\] Invalid entity ID/);

    // 3. No update fields provided
    const noFields = await executeUpdateShortlistedTalentStatus(TEST_PROJECT_ID, {
      shortlistId: 'sl-123456',
    });
    expect(noFields.success).toBe(false);
    expect(noFields.error).toMatch(/At least one field/);

    // 4. Invalid status
    const badStatus = await executeUpdateShortlistedTalentStatus(TEST_PROJECT_ID, {
      shortlistId: 'sl-123456',
      status: 'unknown_status' as any,
    });
    expect(badStatus.success).toBe(false);
    expect(badStatus.error).toMatch(/Invalid status "unknown_status"/);

    // 5. Shortlisted doc not found
    existingShortlistDoc = null;
    const notFound = await executeUpdateShortlistedTalentStatus(TEST_PROJECT_ID, {
      shortlistId: 'sl-999999',
      status: 'booked',
    });
    expect(notFound.success).toBe(false);
    expect(notFound.error).toMatch(/Shortlisted candidate "sl-999999" not found/);
  });

  it('executeUpdateShortlistedTalentStatus_validUpdates_updatesDocAndProject_test', async () => {
    const updateResult = await executeUpdateShortlistedTalentStatus(TEST_PROJECT_ID, {
      shortlistId: 'sl-123456',
      status: 'booked',
      notes: 'Offer accepted, onboarded for Week 44.',
      dayRate: '£550',
    });

    expect(updateResult.success).toBe(true);
    const data = updateResult.data as any;
    expect(data.status).toBe('booked');
    expect(data.notes).toBe('Offer accepted, onboarded for Week 44.');
    expect(data.dayRate).toBe('£550');
    expect(updateMock).toHaveBeenCalled();
  });

  it('executeRemoveShortlistedTalent_missingOrInvalid_returnsExplicitError_test', async () => {
    // 1. Missing shortlistId
    const noId = await executeRemoveShortlistedTalent(TEST_PROJECT_ID, {} as any);
    expect(noId.success).toBe(false);
    expect(noId.error).toMatch(/Missing required parameter "shortlistId"/);

    // 2. Malformed ID
    const badId = await executeRemoveShortlistedTalent(TEST_PROJECT_ID, { shortlistId: 'not-sl' });
    expect(badId.success).toBe(false);
    expect(badId.error).toMatch(/\[FAIL FAST\] Invalid entity ID/);

    // 3. Not found
    existingShortlistDoc = null;
    const notFound = await executeRemoveShortlistedTalent(TEST_PROJECT_ID, { shortlistId: 'sl-999999' });
    expect(notFound.success).toBe(false);
    expect(notFound.error).toMatch(/Shortlisted candidate "sl-999999" not found/);
  });

  it('executeRemoveShortlistedTalent_validId_deletesDocAndUpdatesProject_test', async () => {
    const removeResult = await executeRemoveShortlistedTalent(TEST_PROJECT_ID, {
      shortlistId: 'sl-123456',
    });

    expect(removeResult.success).toBe(true);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(removeResult.data).toEqual({
      projectId: TEST_PROJECT_ID,
      shortlistId: 'sl-123456',
      removedCandidateName: 'Sarah Connor',
    });
  });
});
