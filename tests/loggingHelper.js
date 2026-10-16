const { test: base, expect } = require('@playwright/test');
const { FieldValue } = require('@google-cloud/firestore');
const { getDb, getFunctionUrl, assertServicesRunning } = require('./cloudHelpers.js');

// Extend base Playwright test object with testConfig fixture, real-time logging, function_logs writes, and browser console error capture
const test = base.extend({
  context: async ({ context }, use) => {
    const attachConsoleListeners = (page) => {
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error(`[BROWSER CONSOLE ERROR] ${msg.text()}`);
        }
      });
      page.on('pageerror', error => {
        console.error(`[BROWSER UNCAUGHT EXCEPTION] ${error.stack || error.message || error}`);
      });
    };

    context.on('page', page => {
      attachConsoleListeners(page);
    });

    context.pages().forEach(page => {
      attachConsoleListeners(page);
    });

    await use(context);
  },
  page: async ({ page }, use, testInfo) => {
    const consoleErrors = [];

    const handleConsole = msg => {
      if (msg.type() === 'error') {
        const errorMsg = `[BROWSER CONSOLE ERROR] ${msg.text()}`;
        console.error(errorMsg);
        consoleErrors.push(errorMsg);
      }
    };

    const handlePageError = error => {
      const errorMsg = `[BROWSER UNCAUGHT EXCEPTION] ${error.stack || error.message || error}`;
      console.error(errorMsg);
      consoleErrors.push(errorMsg);
    };

    page.on('console', handleConsole);
    page.on('pageerror', handlePageError);

    await use(page);

    if (consoleErrors.length > 0 && testInfo) {
      testInfo.attachments.push({
        name: 'browser-console-errors',
        contentType: 'text/plain',
        body: Buffer.from(consoleErrors.join('\n'))
      });
    }
  },
  testConfig: [async ({ }, use, testInfo) => {
    // Extract test configuration options from Playwright project settings (local vs production)
    const options = testInfo.project.use || {};
    const isProduction = Boolean(options.isProduction);
    const googleCloudProject = options.googleCloudProject || process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'scriptorium-503507';

    const hostUrl = options.baseURL || (isProduction ? `https://${googleCloudProject}.web.app` : 'http://localhost:3000');

    const testConfig = {
      isProduction,
      googleCloudProject,
      baseURL: hostUrl,
      hostUrl
    };

    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // Instantiate and assign Db, Storage, and cloud helper services directly to testConfig
    testConfig.db = getDb(testConfig);
    testConfig.getFunctionUrl = (fnName) => getFunctionUrl(testConfig, fnName);

    let unsubscribe = null;
    const db = testConfig.db;
    const startTime = new Date();
    const label = isProduction ? 'PROD LOG' : 'LOCAL LOG';

    try {
      // Write test start telemetry log directly to function_logs collection in Firestore
      await db.collection('function_logs').add({
        timestamp: FieldValue.serverTimestamp(),
        level: 'info',
        message: `[TEST START] ${testInfo.title}`,
        details: {
          testName: testInfo.title,
          file: testInfo.file,
          status: 'running',
          isProduction
        }
      });

      console.log(`[${label}] Connected to Firestore database '(default)' for project '${googleCloudProject}'. Tailing logs since ${startTime.toISOString()}...`);

      // Real-time listener for function_logs collection
      unsubscribe = db.collection('function_logs')
        .where('timestamp', '>=', startTime)
        .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data();
              const level = (data.level || 'info').toUpperCase();
              console.log(`[${label}] [${level}] ${data.message}`);
              if (data.details) {
                console.log(`[${label}] Details:`, JSON.stringify(data.details));
              }
            }
          });
        }, () => {
          // Ignore listener errors on test teardown
        });
    } catch (e) {
      // Ignore logger initialization failure
    }

    await use(testConfig);

    // Write test completion telemetry log directly to function_logs collection in Firestore
    if (db) {
      try {
        await db.collection('function_logs').add({
          timestamp: FieldValue.serverTimestamp(),
          level: testInfo.status === 'passed' ? 'info' : 'error',
          message: `[TEST END] ${testInfo.title} - Status: ${testInfo.status || 'completed'}`,
          details: {
            testName: testInfo.title,
            status: testInfo.status,
            durationMs: testInfo.duration,
            isProduction,
            error: testInfo.error ? {
              message: testInfo.error.message,
              location: testInfo.error.location
            } : undefined
          }
        });
      } catch (e) { }
    }

    if (typeof unsubscribe === 'function') {
      try { unsubscribe(); } catch (e) { }
    }
  }, { auto: true, scope: 'test' }]
});

module.exports = {
  test,
  expect,
  assertServicesRunning
};
