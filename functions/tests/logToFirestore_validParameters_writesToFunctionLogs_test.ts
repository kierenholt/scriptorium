import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logToFirestore, sanitizeString, sanitizeLogDetails } from '../src/logger';
import { db } from '../src/firestore';

vi.mock('../src/firestore', () => {
  const addMock = vi.fn().mockResolvedValue({ id: 'mock-log-id' });
  const collectionMock = vi.fn(() => ({ add: addMock }));
  return {
    db: {
      collection: collectionMock,
    },
  };
});

describe('logToFirestore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logToFirestore_validParameters_writesToFunctionLogs_test', async () => {
    await logToFirestore('info', 'Test log message', { key: 'value', token: 'secret-token-12345' }, 'chat');

    expect(db.collection).toHaveBeenCalledWith('function_logs');
    const collectionInstance = (db.collection as any).mock.results[0].value;
    expect(collectionInstance.add).toHaveBeenCalledTimes(1);

    const logEntry = collectionInstance.add.mock.calls[0][0];
    expect(logEntry.service).toBe('chat');
    expect(logEntry.level).toBe('info');
    expect(logEntry.message).toBe('Test log message');
    expect(logEntry.details.key).toBe('value');
    expect(logEntry.details.token).toContain('[MASKED]');
    expect(logEntry.expireAt).toBeInstanceOf(Date);
  });

  it('sanitizeString_controlChars_stripsUnwantedChars_test', () => {
    const raw = 'Hello\u0000\u0007World';
    const cleaned = sanitizeString(raw);
    expect(cleaned).toBe('HelloWorld');
  });

  it('sanitizeLogDetails_sensitiveKeys_masksValues_test', () => {
    const sensitive = {
      password: 'mypassword',
      apiKey: 'ai-key-999',
      normalField: 'visible',
    };
    const sanitized = sanitizeLogDetails(sensitive);
    expect(sanitized.password).toBe('***MASKED***');
    expect(sanitized.apiKey).toContain('[MASKED]');
    expect(sanitized.normalField).toBe('visible');
  });
});
