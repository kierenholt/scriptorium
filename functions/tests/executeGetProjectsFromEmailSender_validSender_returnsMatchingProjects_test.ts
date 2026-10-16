import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGetProjectsFromEmailSender } from '../src/tools/emailExecutors';
import { db } from '../src/firestore';

vi.mock('../src/firestore', () => {
  const emailsDocs = [
    {
      id: 'em-a1b2c3',
      data: () => ({
        to: ['candidate@agency.com'],
        from: 'info@seamcode.co.uk',
        projectId: 'pr-7k4x9q',
      }),
    },
    {
      id: 'em-d4e5f6',
      data: () => ({
        to: ['other@agency.com'],
        from: 'info@seamcode.co.uk',
        projectId: 'pr-1a2b3c',
      }),
    },
  ];

  const projectsDocs = [
    {
      id: 'pr-7k4x9q',
      data: () => ({
        id: 'pr-7k4x9q',
        title: 'German Transcreation Hub',
        status: 'in_progress',
        description: 'Vetted linguists and translation pipeline',
        emails: [],
      }),
    },
    {
      id: 'pr-1a2b3c',
      data: () => ({
        id: 'pr-1a2b3c',
        title: 'Social Media Copywriting',
        status: 'draft',
        description: 'Ad copy campaign',
        emails: [],
      }),
    },
  ];

  const collectionMock = vi.fn((colName: string) => {
    if (colName === 'emails') {
      return {
        get: vi.fn().mockResolvedValue({ docs: emailsDocs }),
      };
    }
    if (colName === 'projects') {
      return {
        get: vi.fn().mockResolvedValue({ docs: projectsDocs }),
      };
    }
    return {
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
  });

  return {
    db: {
      collection: collectionMock,
    },
  };
});

describe('executeGetProjectsFromEmailSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executeGetProjectsFromEmailSender_validSender_returnsMatchingProjects_test', async () => {
    const result = await executeGetProjectsFromEmailSender('pr-7k4x9q', {
      senderEmail: 'candidate@agency.com',
    });

    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(1);
    const projects = result.data?.projects as any[];
    expect(projects[0].projectId).toBe('pr-7k4x9q');
    expect(projects[0].title).toBe('German Transcreation Hub');
  });

  it('executeGetProjectsFromEmailSender_missingSender_returnsExplicitError_test', async () => {
    const result = await executeGetProjectsFromEmailSender('pr-7k4x9q', {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('MISSING_SENDER_EMAIL');
  });
});
