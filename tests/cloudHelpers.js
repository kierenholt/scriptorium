const { Firestore } = require('@google-cloud/firestore');

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

  const frontendUrl = testConfig.baseURL || 'http://localhost:3000';
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const functionsUrl = 'http://127.0.0.1:5001';

  // 1. Assert Frontend is running
  try {
    const res = await fetch(frontendUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!res) throw new Error('No response received');
  } catch (err) {
    throw new Error(
      `[FAIL FAST - MANDATORY SERVICE CHECK] Frontend service at ${frontendUrl} is OFFLINE: ${err.message}. Please start it before running tests.`
    );
  }

  // 2. Assert Firestore emulator is running
  try {
    const res = await fetch(`http://${firestoreHost}`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!res) throw new Error('No response received');
  } catch (err) {
    throw new Error(
      `[FAIL FAST - MANDATORY SERVICE CHECK] Firestore emulator at http://${firestoreHost} is OFFLINE: ${err.message}. Please start it before running tests.`
    );
  }

  // 3. Assert Functions emulator is running
  try {
    const res = await fetch(functionsUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!res) throw new Error('No response received');
  } catch (err) {
    throw new Error(
      `[FAIL FAST - MANDATORY SERVICE CHECK] Functions emulator at ${functionsUrl} is OFFLINE: ${err.message}. Please start it before running tests.`
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
