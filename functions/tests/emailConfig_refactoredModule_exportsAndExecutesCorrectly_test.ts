import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

describe('emailConfig', () => {
  const configPath = path.resolve(__dirname, '../../gcloud/email/config.js');
  let emailConfig: any;

  beforeEach(() => {
    vi.resetModules();
    emailConfig = require(configPath);
  });

  it('emailConfig_initialState_exportsRequiredProperties_test', () => {
    expect(emailConfig).toBeDefined();
    expect(typeof emailConfig.useEmulators).toBe('boolean');
    expect(typeof emailConfig.loadEnv).toBe('function');
    expect(typeof emailConfig.db).toBe('object');
    expect(typeof emailConfig.region).toBe('string');
    expect(emailConfig.region).toBe('europe-west2');
    expect(typeof emailConfig.sanitizeLogDetails).toBe('function');
    expect(typeof emailConfig.logToFirestore).toBe('function');
    expect(typeof emailConfig.createCloudFunction).toBe('function');
    expect(typeof emailConfig.setupFirestoreLogging).toBe('function');
    expect(typeof emailConfig.getProdDb).toBe('function');
    expect(typeof emailConfig.logToProductionFirestore).toBe('function');
    expect(typeof emailConfig.sendEmailRequest).toBe('function');
    expect(typeof emailConfig.syncCVLocation).toBe('function');
    expect(typeof emailConfig.syncMetadataJsonl).toBe('function');
  });

  it('sanitizeLogDetails_sensitiveFields_masksCorrectly_test', () => {
    const sensitive = {
      password: 'secret_password_123',
      apiKey: 'key_live_999888777',
      token: 'jwt_header.payload.signature',
      paymentMethodId: 'pm_123456789',
      normalField: 'visible_data',
      nested: {
        subscriberToken: 'token_abc',
        safe: 42
      }
    };

    const sanitized = emailConfig.sanitizeLogDetails(sensitive);
    expect(sanitized.password).toBe('***MASKED***');
    expect(sanitized.paymentMethodId).toBe('***MASKED***');
    expect(sanitized.apiKey).toContain('[MASKED]');
    expect(sanitized.token).toContain('[MASKED]');
    expect(sanitized.normalField).toBe('visible_data');
    expect(sanitized.nested.subscriberToken).toContain('[MASKED]');
    expect(sanitized.nested.safe).toBe(42);
  });

  it('sanitizeLogDetails_longStrings_truncatesOverLimit_test', () => {
    const longString = 'x'.repeat(3000);
    const sanitized = emailConfig.sanitizeLogDetails({ text: longString });
    expect(sanitized.text.length).toBeLessThan(2100);
    expect(sanitized.text).toContain('[truncated, length: 3000]');
  });

  it('createCloudFunction_optionsRequest_returns204NoContent_test', async () => {
    const handler = vi.fn();
    const service = emailConfig.createCloudFunction('Test Service', handler);

    let statusCode = 0;
    let endBody = '';
    const headers: Record<string, string> = {};

    const req = {
      method: 'OPTIONS',
      headers: {},
      url: '/test'
    };

    const res: any = {
      setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
      statusCode: 200,
      end: (b: string) => { endBody = b; }
    };

    await service(req, res);

    expect(res.statusCode).toBe(204);
    expect(headers['access-control-allow-origin']).toBe('*');
    expect(headers['access-control-allow-methods']).toBe('GET, POST, OPTIONS');
    expect(handler).not.toHaveBeenCalled();
  });

  it('createCloudFunction_validPostAction_executesHandler_test', async () => {
    const actionHandler = vi.fn().mockImplementation((req, res) => {
      res.status(200).json({ success: true, processed: req.body.data });
    });

    const service = emailConfig.createCloudFunction('Test Service', actionHandler);

    let outputJson: any = null;
    let statusCode = 0;
    const headers: Record<string, string> = {};

    const req = {
      method: 'POST',
      body: { action: 'testAction', data: 'sample' },
      headers: { 'x-execution-id': 'exec-12345' },
      url: '/emailService'
    };

    const res: any = {
      setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; },
      statusCode: 200,
      end: (b: string) => {
        try {
          outputJson = JSON.parse(b);
        } catch {
          outputJson = b;
        }
      }
    };

    await service(req, res);

    expect(actionHandler).toHaveBeenCalled();
    expect(outputJson).toEqual({ success: true, processed: 'sample' });
  });

  it('syncCVLocation_validTalentId_returnsGcsUri_test', async () => {
    const uri = await emailConfig.syncCVLocation('talent-123', true);
    expect(uri).toBe('gs://scriptorium-searchable/cvs/talent-123.pdf');

    const nonSearchableUri = await emailConfig.syncCVLocation('talent-123', false);
    expect(nonSearchableUri).toBe('gs://scriptorium-non-searchable/cvs/talent-123.pdf');
  });

  it('sendEmailRequest_missingFetch_throwsFailFastError_test', async () => {
    const originalFetch = globalThis.fetch;
    try {
      (globalThis as any).fetch = undefined;
      await expect(emailConfig.sendEmailRequest('test', {})).rejects.toThrow('[FAIL FAST]');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('sendEmailRequest_validEndpoint_postsDataAndReturnsResult_test', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { emailId: 'mock-email-id-999' } }),
    });
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = mockFetch as any;
      const res = await emailConfig.sendEmailRequest('sendThankYouEmail', { email: 'test@domain.com' });
      expect(res).toEqual({ emailId: 'mock-email-id-999' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/8085|emailService/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'sendThankYouEmail', email: 'test@domain.com' }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

