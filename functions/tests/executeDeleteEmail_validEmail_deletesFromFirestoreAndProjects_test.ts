import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeDeleteCandidateEmailMessage, executeDeleteEmail } from '../src/tools/emailExecutors';
import { db } from '../src/firestore';

vi.mock('../src/firestore', () => {
  const emailDeleteMock = vi.fn().mockResolvedValue({});
  const projectSetMock = vi.fn().mockResolvedValue({});

  const emailDocRef = {
    delete: emailDeleteMock,
  };

  const projectDocRef = {
    set: projectSetMock,
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'pr-7k4x9q',
        title: 'German Transcreation Hub',
        status: 'in_progress',
        emails: [
          {
            id: 'em-a1b2c3',
            from: 'candidate@agency.com',
            to: 'info@seamcode.co.uk',
            subject: 'Transcreation Test Submission',
            direction: 'inbound',
            timestamp: '2026-10-16T12:00:00.000Z',
          },
          {
            id: 'em-other99',
            from: 'other@agency.com',
            to: 'info@seamcode.co.uk',
            subject: 'Other Email',
            direction: 'inbound',
            timestamp: '2026-10-16T12:05:00.000Z',
          },
        ],
      }),
    }),
  };

  const collectionMock = vi.fn((colName: string) => {
    if (colName === 'emails') {
      return {
        doc: vi.fn((docId: string) => ({
          delete: emailDeleteMock,
          get: vi.fn().mockResolvedValue({
            exists: docId === 'em-a1b2c3' || docId === 'em-unassigned',
            id: docId,
            ref: emailDocRef,
            data: () => ({
              id: docId,
              emailId: docId,
              projectId: docId === 'em-a1b2c3' ? 'pr-7k4x9q' : undefined,
              from: 'candidate@agency.com',
              to: 'info@seamcode.co.uk',
              subject: 'Transcreation Test Submission',
              direction: 'inbound',
            }),
          }),
        })),
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true }),
          })),
        })),
      };
    }
    if (colName === 'projects') {
      return {
        doc: vi.fn(() => projectDocRef),
      };
    }
    return {};
  });

  return {
    db: {
      collection: collectionMock,
    },
  };
});

describe('executeDeleteCandidateEmailMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeDeleteEmail_validAssignedEmail_deletesFromFirestoreAndProjects_test', async () => {
    const result = await executeDeleteCandidateEmailMessage('pr-7k4x9q', {
      emailId: 'em-a1b2c3',
    });

    expect(result.success).toBe(true);
    expect(result.data?.emailId).toBe('em-a1b2c3');
    expect(result.data?.projectId).toBe('pr-7k4x9q');
    expect(result.message).toContain('permanently deleted');
  });

  it('executeDeleteEmail_missingEmailId_returnsExplicitError_test', async () => {
    const result = await executeDeleteCandidateEmailMessage('pr-7k4x9q', {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('MISSING_EMAIL_ID');
    expect(result.message).toContain('[FAIL FAST]');
  });

  it('executeDeleteEmail_unassignedEmail_deletesCleanly_test', async () => {
    const result = await executeDeleteEmail('', {
      emailId: 'em-unassigned',
    });

    expect(result.success).toBe(true);
    expect(result.data?.emailId).toBe('em-unassigned');
  });
});
