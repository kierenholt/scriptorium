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

    const supervisorToken = process.env.VITE_SUPERVISOR_ACCESS_TOKEN || 'a1e839a5143ce7f6b744ce6f4eed57bf';
    await context.addInitScript((token) => {
      try {
        if (!window.__DISABLE_TEST_SUPERVISOR_AUTH__) {
          window.sessionStorage.setItem('scriptorium_supervisor_token', token);
        }
        window.localStorage.removeItem('scriptorium_open_tabs');
        window.localStorage.removeItem('scriptorium_active_tab');
      } catch (e) {
        // Ignore SecurityError on about:blank or uninitialized documents
      }
    }, supervisorToken);

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
    const supervisorToken = options.supervisorToken || process.env.VITE_SUPERVISOR_ACCESS_TOKEN || 'a1e839a5143ce7f6b744ce6f4eed57bf';

    const testConfig = {
      isProduction,
      googleCloudProject,
      baseURL: hostUrl,
      hostUrl,
      supervisorToken
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
        },
        expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
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
          },
          expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
      } catch (e) { }
    }

    if (typeof unsubscribe === 'function') {
      try { unsubscribe(); } catch (e) { }
    }

    // MANDATORY REQUIREMENT: UNCONDITIONALLY OUTPUT THE TAIL OF THE function_logs TABLE
    if (db) {
      try {
        const snap = await db.collection('function_logs')
          .where('timestamp', '>=', startTime)
          .get();

        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Sort chronologically by timestamp
        docs.sort((a, b) => {
          const timeA = a.timestamp ? (typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0;
          const timeB = b.timestamp ? (typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0;
          return timeA - timeB;
        });

        const separator = '═'.repeat(74);
        const logLines = [];
        logLines.push(`\n${separator}`);
        logLines.push(`📋 [TAIL OF function_logs] Test: "${testInfo.title}" (${docs.length} entries)`);
        logLines.push(separator);

        if (docs.length === 0) {
          logLines.push('  (No new log entries recorded in function_logs during this test run)');
        } else {
          docs.forEach(data => {
            const timeStr = data.timestamp ? (typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString();
            const serviceStr = data.service ? `[${data.service.toUpperCase()}] ` : '';
            const levelStr = `[${(data.level || 'INFO').toUpperCase()}]`;
            const messageStr = data.message ? data.message.trim() : '';
            logLines.push(`  [${timeStr}] ${serviceStr}${levelStr} ${messageStr}`);
            if (data.details && typeof data.details === 'object' && Object.keys(data.details).length > 0) {
              logLines.push(`      Details: ${JSON.stringify(data.details)}`);
            }
          });
        }
        logLines.push(`${separator}\n`);

        console.log(logLines.join('\n'));

        if (testInfo) {
          testInfo.attachments.push({
            name: 'tail-function-logs',
            contentType: 'text/plain',
            body: Buffer.from(logLines.join('\n'))
          });
        }
      } catch (err) {
        console.warn(`[WARNING] Failed to fetch tail of function_logs:`, err.message);
      }
    }
  }, { auto: true, scope: 'test' }]
});


module.exports = {
  test,
  expect,
  assertServicesRunning
};
