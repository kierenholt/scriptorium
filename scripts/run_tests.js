#!/usr/bin/env node

/**
 * Scriptorium Test Runner Script
 * 
 * Interactive and CLI test runner.
 * Scans tests/ for Playwright specs, performs pre-flight system health checks,
 * prompts for environment profile (local or production), and executes Playwright sequentially.
 * 
 * Usage:
 *   node scripts/run_tests.js [test-num-or-name] [env] [mode]
 *   node scripts/run_tests.js
 *   npm test
 */

const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '../');
const TESTS_DIR = path.resolve(ROOT_DIR, 'tests');
const CONFIG_PATH = path.resolve(TESTS_DIR, 'playwright.config.js');

function ask(question, defaultVal = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const prompt = defaultVal ? `${question} (default: ${defaultVal}): ` : `${question}: `;
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultVal);
    });
  });
}

function clearScreen() {
  console.clear();
  process.stdout.write('\x1Bc');
}

/**
 * Recursively find test files (.spec.js, .test.js, .spec.ts, .test.ts) inside tests/
 */
function findTestFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'test-results' && item.name !== '.git') {
        findTestFiles(fullPath, fileList);
      }
    } else if (
      item.isFile() &&
      (item.name.endsWith('.spec.js') ||
       item.name.endsWith('.test.js') ||
       item.name.endsWith('.spec.ts') ||
       item.name.endsWith('.test.ts'))
    ) {
      const relativePath = path.relative(ROOT_DIR, fullPath);
      const category = path.dirname(path.relative(TESTS_DIR, fullPath));
      fileList.push({
        name: item.name,
        relativePath: relativePath,
        fullPath: fullPath,
        category: category === '.' ? 'Root / Core' : category
      });
    }
  }

  return fileList;
}

/**
 * Group test files by category
 */
function groupByCategory(testFiles) {
  const groups = {};
  for (const file of testFiles) {
    const cat = file.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(file);
  }
  return groups;
}

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

async function verifyLocalService(name, port, defaultUrl) {
  if (await probeTcp(port, '127.0.0.1')) return { name, online: true, method: 'TCP (IPv4)', url: defaultUrl };
  if (await probeTcp(port, '::1')) return { name, online: true, method: 'TCP (IPv6)', url: defaultUrl };
  if (await probeHttp(defaultUrl)) return { name, online: true, method: 'HTTP GET', url: defaultUrl };
  if (isPortListeningInProc(port)) return { name, online: true, method: 'Kernel (/proc/net/tcp)', url: defaultUrl };
  return { name, online: false, method: null, url: defaultUrl };
}

/**
 * Pre-flight health check verifying connectivity across Scriptorium components.
 */
async function runSystemHealthCheck(envProfile = 'local') {
  const isProd = envProfile === 'production';

  console.log(`\n🏥 [HEALTH CHECK] Performing pre-flight health check (${envProfile.toUpperCase()})...`);
  console.log('─'.repeat(70));

  if (!isProd) {
    const services = [
      { name: 'Supervisor Web App (Vite)', port: 3000, url: process.env.LOCAL_BASE_URL || 'http://localhost:3000' },
      { name: 'Functions Emulator', port: 5001, url: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:5001' },
      { name: 'Firestore Emulator', port: 8080, url: `http://${process.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}` },
    ];

    let allHealthy = true;
    for (const svc of services) {
      const res = await verifyLocalService(svc.name, svc.port, svc.url);
      if (res.online) {
        console.log(`  ✅ ${res.name.padEnd(28)} -> ONLINE  via ${res.method} [${res.url}]`);
      } else {
        console.log(`  ❌ ${res.name.padEnd(28)} -> OFFLINE [${res.url}]`);
        allHealthy = false;
      }
    }

    console.log('─'.repeat(70));
    if (!allHealthy) {
      console.log('⚠️  [HEALTH CHECK WARNING] One or more Scriptorium services are unreachable!\n');
    } else {
      console.log('✨ [HEALTH CHECK OK] All required Scriptorium services are online!\n');
    }
    return allHealthy;
  }

  // Production check
  let prodBaseUrl = 'https://scriptorium-503507.web.app';
  let prodRegion = 'europe-west2';
  let prodProjectId = 'scriptorium-503507';

  const prodEnvPath = path.resolve(ROOT_DIR, '.env.production');
  if (fs.existsSync(prodEnvPath)) {
    const prodEnvContent = fs.readFileSync(prodEnvPath, 'utf8');
    prodEnvContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...valParts] = trimmed.split('=');
      const val = valParts.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key.trim() === 'PROD_BASE_URL') prodBaseUrl = val;
      if (key.trim() === 'VITE_FIREBASE_REGION') prodRegion = val;
      if (key.trim() === 'VITE_FIREBASE_PROJECT_ID' || key.trim() === 'GOOGLE_CLOUD_PROJECT') prodProjectId = val;
    });
  }

  const prodFunctionsUrl = `https://${prodRegion}-${prodProjectId}.cloudfunctions.net`;
  const prodServices = [
    { name: 'Supervisor Web App', url: prodBaseUrl, method: 'GET' },
    { name: 'Cloud Functions Base', url: prodFunctionsUrl, method: 'GET' },
  ];

  const results = await Promise.all(prodServices.map(async (svc) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(svc.url, { method: svc.method, signal: controller.signal });
      clearTimeout(timeoutId);
      return { ...svc, online: true, status: res.status, error: null };
    } catch (err) {
      return { ...svc, online: false, status: null, error: err.message };
    }
  }));

  let allHealthy = true;
  for (const res of results) {
    if (res.online) {
      console.log(`  ✅ ${res.name.padEnd(28)} -> ONLINE  (HTTP ${res.status}) [${res.url}]`);
    } else {
      console.log(`  ❌ ${res.name.padEnd(28)} -> OFFLINE (${res.error}) [${res.url}]`);
      allHealthy = false;
    }
  }

  console.log('─'.repeat(70));
  if (!allHealthy) {
    console.log('⚠️  [HEALTH CHECK WARNING] One or more Scriptorium services are unreachable!\n');
  } else {
    console.log('✨ [HEALTH CHECK OK] All required Scriptorium services are online!\n');
  }
  return allHealthy;
}

/**
 * Execute Playwright command
 */
async function runPlaywrightCommand(testPath, envProfile, extraFlags = []) {
  return new Promise((resolve) => {
    const args = ['playwright', 'test'];

    if (testPath) {
      args.push(testPath);
    }

    args.push(`--config=${CONFIG_PATH}`);

    if (envProfile === 'local' || envProfile === 'production') {
      args.push(`--project=${envProfile}`);
    }

    if (extraFlags.length > 0) {
      args.push(...extraFlags);
    }

    const startTime = Date.now();
    const child = spawn('npx', args, {
      cwd: ROOT_DIR,
      shell: true,
      env: {
        ...process.env,
        ...(envProfile === 'production' ? { TARGET_ENV: 'production', NODE_ENV: 'production', VITE_USE_EMULATORS: '0' } : {}),
        FORCE_COLOR: '1'
      }
    });

    let output = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        output += data.toString();
      });
    }

    child.on('close', (code) => {
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

      // Display output if test failed or in verbose mode
      if (code !== 0) {
        console.log(`\n🚀 Executing: npx ${args.join(' ')}\n`);
        console.log('─'.repeat(70) + '\n');
        console.log(output);
        console.log('\n' + '─'.repeat(70));
      } else {
        console.log(output);
      }

      resolve({ code, durationSec });
    });
  });
}

async function main() {
  console.log('=== Scriptorium E2E Test Runner ===\n');

  const testFiles = findTestFiles(TESTS_DIR);
  if (testFiles.length === 0) {
    console.warn(`[Warning] No test spec files found in ${TESTS_DIR}.`);
    console.log('To run backend unit tests directly, run: npm --prefix functions test\n');
  }

  // Construct options menu list
  const options = [
    { label: `🚀 [RUN ALL E2E TESTS] (${testFiles.length} files sequentially)`, type: 'ALL', value: 'ALL' },
    ...Object.entries(groupByCategory(testFiles)).map(([cat, files]) => ({
      label: `📂 [RUN CATEGORY] ${cat.toUpperCase()} (${files.length} tests)`,
      type: 'CATEGORY',
      value: cat,
      files: files
    })),
    ...testFiles.map(f => ({
      label: `📄 [${f.category}] ${f.name}`,
      type: 'FILE',
      value: f.relativePath,
      fileObj: f
    }))
  ];

  const isCliMode = !!(process.argv[2]);
  let testChoiceInput = '';
  let envInput = '';
  let modeInput = '';

  if (isCliMode) {
    testChoiceInput = process.argv[2];
    envInput = process.argv[3] || 'local';
    modeInput = process.argv[4] || '1';
    console.log('Using CLI arguments:');
    console.log(`- Target:      ${testChoiceInput}`);
    console.log(`- Environment: ${envInput}`);
    console.log(`- Mode:        ${modeInput}\n`);
  } else {
    console.log('Available tests:');
    options.forEach((opt, idx) => {
      const numStr = (idx + 1).toString().padStart(2, ' ');
      console.log(`  ${numStr}: ${opt.label}`);
    });
    console.log('');

    testChoiceInput = await ask(`Select test to run (1-${options.length}, or "all")`, 'all');
    while (!testChoiceInput) {
      console.log('Error: Test selection is required.');
      testChoiceInput = await ask(`Select test to run (1-${options.length}, or "all")`, 'all');
    }

    console.log('\nAvailable environment profiles:');
    console.log('  1: 🧪 local       (Runs against local emulator environment & port 3000)');
    console.log('  2: 🌐 production  (Runs against live production environment & .env.production)');
    console.log('  3: 🔄 both        (Sequential run: Local project first, then Production project)\n');

    envInput = await ask('Select environment profile (1: local, 2: production, 3: both)', '1');

    console.log('\nAvailable browser execution modes:');
    console.log('  1: ⚡ Standard Headless Mode (Fastest execution)');
    console.log('  2: 👁️  Headed Browser Mode (--headed)');
    console.log('  3: 🐞 Debug Mode (--debug)\n');

    modeInput = await ask('Select browser mode (1-3)', '1');
    clearScreen();
  }

  // Resolve Test Selection
  let selectedOption = null;
  if (testChoiceInput.toLowerCase() === 'all') {
    selectedOption = options[0];
  } else if (!isNaN(parseInt(testChoiceInput, 10))) {
    const idx = parseInt(testChoiceInput, 10) - 1;
    if (idx >= 0 && idx < options.length) {
      selectedOption = options[idx];
    }
  }

  if (!selectedOption) {
    const match = options.find(o => o.value && o.value.toLowerCase().includes(testChoiceInput.toLowerCase()));
    if (match) {
      selectedOption = match;
    } else {
      console.error(`Error: Invalid test selection "${testChoiceInput}".`);
      process.exit(1);
    }
  }

  // Resolve Environment Selection
  let selectedEnv = 'local';
  if (envInput === '2' || envInput.toLowerCase() === 'production') {
    selectedEnv = 'production';
  } else if (envInput === '3' || envInput.toLowerCase() === 'both') {
    selectedEnv = 'both';
  }

  // Resolve Extra Flags Mode
  let extraFlags = [];
  if (modeInput === '2' || modeInput.toLowerCase() === 'headed') {
    extraFlags = ['--headed'];
  } else if (modeInput === '3' || modeInput.toLowerCase() === 'debug') {
    extraFlags = ['--debug'];
  }

  // Build target list of file paths
  let filesToRun = [];
  let targetLabel = '';

  if (selectedOption.type === 'ALL') {
    filesToRun = testFiles.map(f => f.relativePath);
    targetLabel = `All Tests (${filesToRun.length} files)`;
  } else if (selectedOption.type === 'CATEGORY') {
    filesToRun = selectedOption.files.map(f => f.relativePath);
    targetLabel = `Category: ${selectedOption.value} (${filesToRun.length} files)`;
  } else {
    filesToRun = [selectedOption.value];
    targetLabel = selectedOption.value;
  }

  console.log('\n--- Scriptorium Test Configuration ---');
  console.log(`- Target:      ${targetLabel}`);
  console.log(`- Environment: ${selectedEnv.toUpperCase()}`);
  console.log(`- Mode:        ${extraFlags.length ? extraFlags.join(' ') : 'headless'}`);
  console.log(`- Files count: ${filesToRun.length}`);
  console.log('--------------------------------------\n');

  if (filesToRun.length === 0) {
    console.log('No test files to execute.');
    process.exit(0);
  }

  let keepRunning = true;

  while (keepRunning) {
    const results = [];

    const environmentsToRun = selectedEnv === 'both' ? ['local', 'production'] : [selectedEnv];

    for (const envProfile of environmentsToRun) {
      console.log(`\n=======================================================`);
      console.log(`🚀 STARTING RUN: ${envProfile.toUpperCase()} ENVIRONMENT`);
      console.log(`=======================================================`);

      const allHealthy = await runSystemHealthCheck(envProfile);
      if (!allHealthy) {
        console.error('❌ [FAIL FAST - PROJECT RULE] ALL TESTS MUST FIRST CHECK THAT THE SERVICES ARE RUNNING.');
        console.error('Aborting test run immediately because one or more required services are OFFLINE.\n');
        process.exit(1);
      }

      for (let i = 0; i < filesToRun.length; i++) {
        const file = filesToRun[i];
        console.log(`\n[${i + 1}/${filesToRun.length}] (${envProfile}) Running: ${file}...`);
        const { code, durationSec } = await runPlaywrightCommand(file, envProfile, extraFlags);

        results.push({
          file,
          env: envProfile,
          code,
          durationSec,
          passed: code === 0
        });

        if (code === 0) {
          console.log(`  ✅ PASSED (${durationSec}s)`);
        } else {
          console.log(`  ❌ FAILED (${durationSec}s)`);
        }
      }
    }

    console.log('\n=======================================================');
    console.log('📊 SCRIPTORIUM TEST EXECUTION SUMMARY');
    console.log('=======================================================');
    let allPassed = true;
    for (const res of results) {
      const icon = res.passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`${icon.padEnd(10)} [${res.env.toUpperCase().padEnd(10)}] ${res.file} (${res.durationSec}s)`);
      if (!res.passed) allPassed = false;
    }
    console.log('=======================================================\n');

    if (isCliMode) {
      process.exit(allPassed ? 0 : 1);
    }

    const rerun = await ask('Run tests again? (y/n)', 'n');
    if (rerun.toLowerCase() !== 'y') {
      keepRunning = false;
      process.exit(allPassed ? 0 : 1);
    }
    clearScreen();
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
