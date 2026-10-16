import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAssignEmailToProject } from '../src/tools/emailExecutors';
import { db } from '../src/firestore';

vi.mock('../src/firestore', () => {
  const emailSetMock = vi.fn().mockResolvedValue({});
  const projectSetMock = vi.fn().mockResolvedValue({});

  const emailDocRef = {
    set: emailSetMock,
  };

  const projectDocRef = {
    set: projectSetMock,
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'pr-7k4x9q',
        title: 'German Transcreation Hub',
        status: 'in_progress',
        emails: [],
      }),
    }),
  };

  const collectionMock = vi.fn((colName: string) => {
    if (colName === 'emails') {
      return {
        doc: vi.fn(() => ({
          set: emailSetMock,
          get: vi.fn().mockResolvedValue({
            exists: true,
            id: 'em-a1b2c3',
            ref: emailDocRef,
            data: () => ({
              id: 'em-a1b2c3',
              from: 'candidate@agency.com',
              to: 'info@seamcode.co.uk',
              subject: 'Transcreation Test Submission',
              body: 'Here is my completed transcreation test.',
              sentAt: '2026-10-16T12:00:00.000Z',
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

describe('executeAssignEmailToProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeAssignEmailToProject_validEmail_associatesEmailWithProject_test', async () => {
    const result = await executeAssignEmailToProject('pr-7k4x9q', {
      emailId: 'em-a1b2c3',
      projectId: 'pr-7k4x9q',
    });
    expect(result.success).toBe(true);
    expect(result.data?.emailId).toBe('em-a1b2c3');
    expect(result.data?.projectId).toBe('pr-7k4x9q');
    expect(result.data?.subject).toBe('Transcreation Test Submission');
    expect(result.data?.direction).toBe('inbound');
  });

  it('executeAssignEmailToProject_missingEmailId_returnsExplicitError_test', async () => {
    const result = await executeAssignEmailToProject('pr-7k4x9q', {
      projectId: 'pr-7k4x9q',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('MISSING_EMAIL_ID');
  });

  it('executeAssignEmailToProject_invalidProjectId_returnsExplicitError_test', async () => {
    const result = await executeAssignEmailToProject('pr-7k4x9q', {
      emailId: 'em-a1b2c3',
      projectId: 'invalid_id',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_PROJECT_ID');
  });
});
