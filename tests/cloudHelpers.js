const { Firestore } = require('@google-cloud/firestore');
const net = require('net');
const http = require('http');
const fs = require('fs');

/**
 * Returns an initialized Firestore instance for testing based on testConfig.
 * @param {Object} testConfig
 */
function getDb(testConfig = {}) {
  const isProd = Boolean(testConfig.isProduction);
  const projectId = testConfig.googleCloudProject || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'scriptorium-503507';

  if (isProd) {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS;
    return new Firestore({ projectId });
  }

  const host = testConfig.firestoreEmulatorHost || process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  process.env.FIRESTORE_EMULATOR_HOST = host;
  return new Firestore({ projectId });
}

/**
 * Resolves a Cloud Function URL for Scriptorium based on environment.
 * @param {Object} testConfig
 * @param {string} functionName
 */
function getFunctionUrl(testConfig = {}, functionName = '') {
  const isProd = Boolean(testConfig.isProduction);
  const region = testConfig.firebaseRegion || process.env.VITE_FIREBASE_REGION || 'europe-west2';
  const projectId = testConfig.googleCloudProject || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'scriptorium-503507';

  if (isProd) {
    const prodBase = `https://${region}-${projectId}.cloudfunctions.net`;
    return `${prodBase}/${functionName}`;
  }

  const serviceUrl = testConfig.functionsUrl || process.env.VITE_API_BASE_URL || `http://127.0.0.1:5001/${projectId}/${region}`;
  return `${serviceUrl.replace(/\/$/, '')}/${functionName}`;
}

/**
 * Helper to check if a TCP port is in LISTEN state in /proc/net/tcp or tcp6.
 */
function isPortListeningInProc(port) {
  try {
    for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.trim().split('\n').slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[3] === '0A') {
          const portHex = parts[1].split(':')[1];
          if (parseInt(portHex, 16) === port) return true;
        }
      }
    }
  } catch {}
  return false;
}

/**
 * Direct TCP socket connection probe.
 */
function probeTcp(port, host = '127.0.0.1', timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

/**
 * HTTP request probe.
 */
function probeHttp(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname || '/',
          method: 'GET',
          timeout: timeoutMs,
        },
        () => resolve(true)
      );
      req.once('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.once('error', () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Resilient multi-method service verification (TCP -> HTTP -> /proc).
 */
async function verifyLocalService(name, port, defaultUrl) {
  if (await probeTcp(port, '127.0.0.1')) return true;
  if (await probeTcp(port, '::1')) return true;
  if (await probeHttp(defaultUrl)) return true;
  if (isPortListeningInProc(port)) return true;
  return false;
}

/**
 * MANDATORY PROJECT RULE:
 * AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING.
 * Throws an explicit error immediately if any required service is unreachable.
 * 
 * @param {Object} testConfig
 */
async function assertServicesRunning(testConfig = {}) {
  const isProd = Boolean(testConfig.isProduction);

  if (isProd) {
    const prodUrl = testConfig.baseURL || 'https://scriptorium-503507.web.app';
    try {
      const res = await fetch(prodUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (!res) throw new Error('No response received');
    } catch (err) {
      throw new Error(`[FAIL FAST - MANDATORY SERVICE CHECK] Production hosting at ${prodUrl} is OFFLINE: ${err.message}`);
    }
    return;
  }

  // Multi-method verification for local services
  const isFrontendRunning = await verifyLocalService('Supervisor Frontend', 3000, testConfig.baseURL || 'http://localhost:3000');
  if (!isFrontendRunning) {
    throw new Error(
      `[FAIL FAST - MANDATORY SERVICE CHECK] Frontend service on port 3000 is OFFLINE. Please start it before running tests.`
    );
  }

  const isFirestoreRunning = await verifyLocalService('Firestore Emulator', 8080, 'http://127.0.0.1:8080');
  if (!isFirestoreRunning) {
    throw new Error(
      `[FAIL FAST - MANDATORY SERVICE CHECK] Firestore emulator on port 8080 is OFFLINE. Please start it before running tests.`
    );
  }

  const isFunctionsRunning = await verifyLocalService('Functions Emulator', 5001, 'http://127.0.0.1:5001');
  if (!isFunctionsRunning) {
    throw new Error(
      `[FAIL FAST - MANDATORY SERVICE CHECK] Functions emulator on port 5001 is OFFLINE. Please start it before running tests.`
    );
  }
}

/**
 * Purges seeded test projects and message subcollections from Firestore.
 * @param {Object} testConfig
 * @param {Object} options
 * @param {string[]} [options.projectIds]
 */
async function cleanupTestResources(testConfig = {}, {
  projectIds = []
} = {}) {
  const db = testConfig.db || getDb(testConfig);

  if (db && Array.isArray(projectIds)) {
    for (const projectId of projectIds) {
      if (!projectId) continue;
      try {
        const messagesSnap = await db.collection('projects').doc(projectId).collection('messages').get().catch(() => null);
        if (messagesSnap && !messagesSnap.empty) {
          for (const msgDoc of messagesSnap.docs) {
            await msgDoc.ref.delete().catch(() => {});
          }
        }
        await db.collection('projects').doc(projectId).delete().catch(() => {});
      } catch (e) {
        // Continue cleanup
      }
    }
  }
}

module.exports = {
  getDb,
  getFunctionUrl,
  assertServicesRunning,
  cleanupTestResources
};
