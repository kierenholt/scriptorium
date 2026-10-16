#!/usr/bin/env node

/**
 * Service Health Check Script
 * Checks connectivity to Scriptorium frontend, Firebase Functions emulator, and Firestore emulator.
 */

const http = require('http');

const SERVICES = [
  { name: 'Supervisor Frontend (Vite)', url: 'http://localhost:3000' },
  { name: 'Functions Emulator', url: 'http://127.0.0.1:5001' },
  { name: 'Firestore Emulator', url: 'http://127.0.0.1:8080' },
];

async function checkService(name, url, timeoutMs = 3000) {
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
        (res) => {
          resolve({ name, url, online: true, statusCode: res.statusCode, error: null });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({ name, url, online: false, statusCode: null, error: 'Request timed out' });
      });

      req.on('error', (err) => {
        resolve({ name, url, online: false, statusCode: null, error: err.message });
      });

      req.end();
    } catch (err) {
      resolve({ name, url, online: false, statusCode: null, error: err.message });
    }
  });
}

async function main() {
  console.log('\n🔍 [SERVICE CHECK] Inspecting Scriptorium local services...');
  console.log('─'.repeat(70));

  let allOnline = true;
  for (const svc of SERVICES) {
    const res = await checkService(svc.name, svc.url);
    if (res.online) {
      console.log(`  ✅ ${res.name.padEnd(30)} -> ONLINE  (HTTP ${res.statusCode}) [${res.url}]`);
    } else {
      console.log(`  ❌ ${res.name.padEnd(30)} -> OFFLINE (${res.error}) [${res.url}]`);
      allOnline = false;
    }
  }

  console.log('─'.repeat(70));
  if (allOnline) {
    console.log('✨ All local services are ONLINE and ready for tests!\n');
    process.exit(0);
  } else {
    console.log('⚠️  One or more local services are OFFLINE. Please ensure emulators & frontend are running.\n');
    process.exit(1);
  }
}

main();
