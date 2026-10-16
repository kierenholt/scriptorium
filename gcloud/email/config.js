/**
 * Shared configuration, environment loading, and telemetry logging for Scriptorium Email Service.
 */
const path = require('path');
const fs = require('fs');
const util = require('util');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const { Firestore } = require('@google-cloud/firestore');

// AsyncLocalStorage for tracing executionId across asynchronous execution contexts
global.logStorage = global.logStorage || new AsyncLocalStorage();

/**
 * Loads environment variables from .env.local, .env.production, or .env.
 */
function loadEnv() {
  const isProd = process.env.TARGET_ENV === 'production' || process.env.K_SERVICE || process.env.NODE_ENV === 'production';
  const targetEnvFile = isProd ? '.env.production' : '.env.local';
  const baseDirs = [process.cwd(), __dirname, path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')];

  for (const dir of baseDirs) {
    const primaryPath = path.resolve(dir, targetEnvFile);
    const fallbackPath = path.resolve(dir, '.env');
    const envPath = fs.existsSync(primaryPath) ? primaryPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);

    if (envPath) {
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      for (const [key, val] of Object.entries(parsed)) {
        if (!val || val.trim() === '') {
          delete process.env[key];
        } else {
          process.env[key] = val.trim();
        }
      }
      break;
    }
  }
}
loadEnv();

// Cloud Run execution environment cleans emulator overrides
if (process.env.K_SERVICE) {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.STORAGE_EMULATOR_HOST;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const envUseEmulators = String(process.env.VITE_USE_EMULATORS ?? '').trim().toLowerCase();
const useEmulators = !(process.env.K_SERVICE || process.env.NODE_ENV === 'production' || process.env.TARGET_ENV === 'production' || envUseEmulators === '0' || envUseEmulators === 'false');

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'scriptorium-503507';
process.env.GCLOUD_PROJECT = projectId;
process.env.GOOGLE_CLOUD_PROJECT = projectId;

const firestoreHost = process.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
const firestorePort = process.env.VITE_FIRESTORE_EMULATOR_PORT || '8080';
const firestoreEmulatorHost = `${firestoreHost}:${firestorePort}`;

if (useEmulators) {
  process.env.FIRESTORE_EMULATOR_HOST = firestoreEmulatorHost;
  const storageHost = process.env.VITE_STORAGE_EMULATOR_HOST || '127.0.0.1';
  const storagePort = process.env.VITE_STORAGE_EMULATOR_PORT || '9199';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = `${storageHost}:${storagePort}`;
  process.env.STORAGE_EMULATOR_HOST = `http://${storageHost}:${storagePort}`;
}

// Ensure Firebase Admin is initialized once
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();
try {
  db.settings({
    ...(useEmulators ? { host: firestoreEmulatorHost, ssl: false } : {}),
    ignoreUndefinedProperties: true
  });
} catch (e) {
  // Settings already initialized
}

const region = process.env.VITE_FIREBASE_REGION || 'europe-west2';

let prodDb = null;
function getProdDb() {
  if (!prodDb) {
    prodDb = useEmulators ? new Firestore({ projectId, ignoreUndefinedProperties: true }) : admin.firestore();
  }
  return prodDb;
}

/**
 * Sanitizes details objects for Firestore logging by masking secrets and truncating long values.
 */
function sanitizeLogDetails(details) {
  if (details === undefined) return null;
  if (!details || typeof details !== 'object') return details;
  try {
    const sanitized = Array.isArray(details) ? [] : {};
    for (const [key, value] of Object.entries(details)) {
      if (value === undefined) continue;
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey === 'paymentmethodid' || lowerKey === 'payment_method') {
        sanitized[key] = '***MASKED***';
      } else if (lowerKey.includes('apikey') || lowerKey.includes('token') || lowerKey === 'authorization') {
        sanitized[key] = typeof value === 'string' ? `${value.substring(0, 8)}...[MASKED]` : '***MASKED***';
      } else if (key === 'file' && value && typeof value === 'object') {
        sanitized[key] = {
          name: value.name || null,
          type: value.type || null,
          dataLength: (value.data || value.content || '').length
        };
      } else if (typeof value === 'string' && value.length > 2000) {
        sanitized[key] = `${value.substring(0, 2000)}... [truncated, length: ${value.length}]`;
      } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        sanitized[key] = sanitizeLogDetails(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  } catch (e) {
    return { summary: String(details) };
  }
}

/**
 * Explicit helper to write a telemetry record to Firestore 'function_logs'.
 */
async function logToFirestore(level, message, details = null, targetDb = db) {
  try {
    const executionId = global.logStorage ? global.logStorage.getStore() : null;
    const safeDetails = sanitizeLogDetails(details);
    await targetDb.collection('function_logs').add({
      executionId: executionId || null,
      timestamp: FieldValue.serverTimestamp(),
      level: String(level).toLowerCase(),
      message: String(message),
      details: safeDetails ?? null,
      expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });
  } catch (err) {
    console.error('Failed to write to function_logs:', err.message);
  }
}

async function logToProductionFirestore(level, message, details = null) {
  return logToFirestore(level, message, details, getProdDb());
}

/**
 * Console interception that writes console output to Firestore 'function_logs'.
 */
function setupFirestoreLogging(serviceName = 'email-service') {
  if (global.__emailServiceLoggingInitialized) return;
  global.__emailServiceLoggingInitialized = true;

  const originalLog = console.log;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  let isWriting = false;

  const writeLog = (level, args) => {
    if (isWriting) return;
    const executionId = global.logStorage ? global.logStorage.getStore() : null;
    const message = args.map(arg => (typeof arg === 'object' ? util.inspect(arg, { depth: 4 }) : String(arg))).join(' ');
    if (message.includes('Failed to write to function_logs')) return;

    isWriting = true;
    db.collection('function_logs').add({
      executionId: executionId || null,
      service: serviceName,
      level,
      message,
      timestamp: new Date(),
      expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).catch(err => {
      originalError('[LOG ERROR] Failed to write to Firestore:', err.message);
    }).finally(() => {
      isWriting = false;
    });
  };

  console.log = (...args) => { originalLog(...args); writeLog('LOG', args); };
  console.error = (...args) => { originalError(...args); writeLog('ERROR', args); };
  console.info = (...args) => { originalInfo(...args); writeLog('INFO', args); };
  console.warn = (...args) => { originalWarn(...args); writeLog('WARN', args); };
}

/**
 * Enhances response object with express-like status, json, send helpers if missing.
 */
function setupResponseHelpers(res) {
  if (!res.status) res.status = (code) => { res.statusCode = code; return res; };
  if (!res.json) res.json = (body) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  if (!res.send) res.send = (body) => {
    res.setHeader('Content-Type', typeof body === 'object' ? 'application/json' : 'text/html');
    res.end(typeof body === 'object' ? JSON.stringify(body) : body);
  };
}

/**
 * Creates a monitored Cloud Function / HTTP request handler with CORS and execution tracing.
 */
function createCloudFunction(serviceName, actionHandlers) {
  setupFirestoreLogging(serviceName);

  return async (req, res) => {
    loadEnv();
    setupResponseHelpers(res);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-execution-id');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    const executionId = req.headers?.['x-execution-id'] || req.body?.execution_id || crypto.randomUUID();
    const startTime = Date.now();
    const action = req.body?.action || req.query?.action || (req.path || req.url || '').split('?')[0].split('/').filter(Boolean).pop();

    const runDoc = db.collection('function_runs').doc();
    runDoc.set({
      executionId,
      service: serviceName,
      functionName: action || serviceName,
      action: action || req.method,
      status: 'started',
      startTime: new Date(),
      expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }).catch(err => console.error('[STATUS TRACE ERROR] Failed to log started state:', err.message));

    let loggedEnd = false;
    const logEndState = async (status, errMessage = null) => {
      if (loggedEnd) return;
      loggedEnd = true;
      try {
        const updateData = {
          status,
          endTime: new Date(),
          durationMs: Date.now() - startTime
        };
        if (errMessage) updateData.error = String(errMessage);
        await runDoc.set(updateData, { merge: true });
      } catch (err) {
        console.error('[STATUS TRACE ERROR] Failed to log end state:', err.message);
      }
    };

    const originalJson = res.json;
    const originalSend = res.send;

    res.json = function (body) {
      const isError = res.statusCode >= 400 || (body && body.error);
      logEndState(isError ? 'error' : 'completed', isError ? (body?.error || `Status code ${res.statusCode}`) : null);
      return originalJson.call(res, body);
    };

    res.send = function (body) {
      const isError = res.statusCode >= 400;
      logEndState(isError ? 'error' : 'completed', isError ? (typeof body === 'string' ? body : `Status code ${res.statusCode}`) : null);
      return originalSend.call(res, body);
    };

    return global.logStorage.run(executionId, async () => {
      try {
        const handler = typeof actionHandlers === 'function' ? actionHandlers : (action && actionHandlers[action]);
        if (handler) {
          return await handler(req, res);
        }
        res.status(404).json({ error: `Endpoint '${action || 'unknown'}' not found` });
      } catch (error) {
        console.error(`[Unhandled Endpoint Error] ${error.stack || error.message}`);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: error.message || 'Internal server error' });
        }
      }
    });
  };
}

/**
 * Dispatches a POST request to the local or cloud email service endpoint.
 */
async function sendEmailRequest(action, payload) {
  const port = process.env.VITE_EMAIL_SERVICE_PORT || '8085';
  const serviceUrl = process.env.VITE_EMAIL_SERVICE_URL || (useEmulators ? `http://127.0.0.1:${port}` : `https://${region}-${projectId}.cloudfunctions.net/emailService`);

  const fetchFn = globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    throw new Error('[FAIL FAST] fetch is not available in the current runtime environment');
  }

  const response = await fetchFn(serviceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Email service request failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.result;
}

/**
 * Backwards compatibility stubs for legacy sync utilities.
 */
async function syncCVLocation(talentId, searchable) {
  const bucket = searchable ? 'scriptorium-searchable' : 'scriptorium-non-searchable';
  return `gs://${bucket}/cvs/${talentId}.pdf`;
}

async function syncMetadataJsonl() {
  await logToFirestore('info', 'syncMetadataJsonl invoked in email config');
  return true;
}

module.exports = {
  useEmulators,
  loadEnv,
  db,
  region,
  getProdDb,
  sanitizeLogDetails,
  logToProductionFirestore,
  logToFirestore,
  createCloudFunction,
  setupFirestoreLogging,
  syncCVLocation,
  syncMetadataJsonl,
  sendEmailRequest
};
