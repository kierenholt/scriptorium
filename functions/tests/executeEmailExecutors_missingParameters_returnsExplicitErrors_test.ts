import { describe, it, expect, vi } from 'vitest';
import {
  executeSendCandidateEmailMessage,
  executeReadCandidateEmailMessage,
} from '../src/tools/emailExecutors';

describe('emailExecutors', () => {
  it('executeSendCandidateEmailMessage_missingRecipient_returnsExplicitError_test', async () => {
    const result = await executeSendCandidateEmailMessage('proj-1', {
      subject: 'Test Subject',
      body: 'Test Body',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('MISSING_RECIPIENT');
    expect(result.message).toContain('parameter "to" is required');
  });

  it('executeSendCandidateEmailMessage_missingSubject_returnsExplicitError_test', async () => {
    const result = await executeSendCandidateEmailMessage('proj-1', {
      to: 'candidate@example.com',
      body: 'Test Body',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('MISSING_SUBJECT');
    expect(result.message).toContain('parameter "subject" is required');
  });

  it('executeSendCandidateEmailMessage_missingBody_returnsExplicitError_test', async () => {
    const result = await executeSendCandidateEmailMessage('proj-1', {
      to: 'candidate@example.com',
      subject: 'Test Subject',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('MISSING_BODY');
    expect(result.message).toContain('parameter "body" is required');
  });

  it('executeSendCandidateEmailMessage_missingApiKey_returnsExplicitError_test', async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const result = await executeSendCandidateEmailMessage('proj-1', {
        to: 'candidate@example.com',
        subject: 'Test Subject',
        body: 'Test Body',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('MISSING_RESEND_API_KEY');
      expect(result.message).toContain('RESEND_API_KEY environment variable is not configured');
    } finally {
      if (originalKey) process.env.RESEND_API_KEY = originalKey;
    }
  });

  it('executeReadCandidateEmailMessage_noMatchingEmail_returnsNotFound_test', async () => {
    // Mock db to return empty collection
    vi.mock('../src/firestore', () => ({
      db: {
        collection: () => ({
          doc: () => ({
            get: vi.fn().mockResolvedValue({ exists: false }),
          }),
          orderBy: () => ({
            limit: () => ({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            }),
          }),
        }),
      },
    }));

    const result = await executeReadCandidateEmailMessage('proj-1', {
      query: 'nonexistent-query-token-xyz-12345',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('NOT_FOUND');
    expect(result.message).toContain('No email found matching criteria');
  });
});
