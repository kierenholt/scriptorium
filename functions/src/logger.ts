import util from 'util';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firestore';

let loggingInitialized = false;
let isWritingLog = false;

/**
 * Remove invalid Unicode characters from log strings.
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '');
}

/**
 * Recursively sanitize log details object to mask sensitive credentials
 * and truncate excessively long strings.
 */
export function sanitizeLogDetails(details: any): any {
  if (details === undefined) return null;
  if (!details || typeof details !== 'object') return details;

  try {
    const sanitized: Record<string, unknown> = Array.isArray(details) ? ([] as any) : {};
    for (const [key, value] of Object.entries(details)) {
      if (value === undefined) continue;

      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || lowerKey.includes('secret')) {
        sanitized[key] = '***MASKED***';
      } else if (
        lowerKey.includes('apikey') ||
        lowerKey === 'token' ||
        lowerKey === 'authorization'
      ) {
        sanitized[key] = typeof value === 'string' ? `${value.substring(0, 8)}...[MASKED]` : '***MASKED***';
      } else if (typeof value === 'string' && value.length > 2000) {

        sanitized[key] = sanitizeString(`${value.substring(0, 2000)}... [truncated, length: ${value.length}]`);
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        sanitized[key] = sanitizeLogDetails(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  } catch (e) {
    return { summary: sanitizeString(String(details)) };
  }
}

/**
 * Explicit helper to write a structured log document into Firestore 'function_logs'.
 */
export async function logToFirestore(
  level: 'info' | 'warn' | 'error' | 'debug' | string,
  message: string,
  details: any = null,
  service: string = 'backend'
): Promise<void> {
  try {
    const safeDetails = sanitizeLogDetails(details);
    const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour TTL

    await db.collection('function_logs').add({
      service,
      level: level.toLowerCase(),
      message: sanitizeString(message),
      details: safeDetails ?? null,
      timestamp: FieldValue.serverTimestamp(),
      expireAt,
    });
  } catch (err) {
    // Fail silently to avoid breaking execution, but use native stderr
    process.stderr.write(`[LOG TO FIRESTORE ERROR] Failed to record log: ${err}\n`);
  }
}

/**
 * Global console interception to automatically mirror console.log, info, warn, and error
 * into the Firestore 'function_logs' table.
 */
export function setupFirestoreLogging(defaultServiceName: string = 'backend'): void {
  if (loggingInitialized) {
    return;
  }
  loggingInitialized = true;

  const originalLog = console.log;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalWarn = console.warn;

  const writeInterception = (level: string, args: any[]) => {
    if (isWritingLog) {
      return;
    }

    try {
      const message = sanitizeString(
        args
          .map((arg) => (typeof arg === 'object' ? util.inspect(arg, { depth: 4, breakLength: Infinity }) : String(arg)))
          .join(' ')
      );

      // Do not write recursive Firestore error traces into Firestore itself
      if (message.includes('[LOG TO FIRESTORE ERROR]')) {
        return;
      }

      isWritingLog = true;
      const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      db.collection('function_logs')
        .add({
          service: defaultServiceName,
          level: level.toLowerCase(),
          message,
          timestamp: FieldValue.serverTimestamp(),
          expireAt,
        })
        .catch((err) => {
          originalError(`[LOG TO FIRESTORE ERROR] Failed writing intercepted console log:`, err);
        })
        .finally(() => {
          isWritingLog = false;
        });
    } catch (e) {
      isWritingLog = false;
    }
  };

  console.log = (...args: any[]) => {
    originalLog(...args);
    writeInterception('info', args);
  };

  console.info = (...args: any[]) => {
    originalInfo(...args);
    writeInterception('info', args);
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    writeInterception('warn', args);
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    writeInterception('error', args);
  };
}
