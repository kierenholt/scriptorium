#!/usr/bin/env node

/**
 * Service Health Check Script
 * Resilient multi-method check (TCP socket -> HTTP -> /proc/net/tcp) for local services.
 */

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  const fullPath = path.resolve(__dirname, '..', filePath);
  const env = {};
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index > 0) {
        const key = trimmed.substring(0, index).trim();
        let value = trimmed.substring(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        if (value !== '') {
          env[key] = value;
        }
      }
    });
  }
  return env;
}

const rootEnv = loadEnvFile('.env');
const localEnv = loadEnvFile('.env.local');
Object.assign(process.env, rootEnv, localEnv);

const frontendPort = parseInt(process.env.PORT || '3000', 10);
const frontendUrl = process.env.LOCAL_BASE_URL || `http://localhost:${frontendPort}`;
const functionsPort = parseInt(process.env.FUNCTIONS_PORT || '5001', 10);
const functionsUrl = process.env.VITE_API_BASE_URL || `http://127.0.0.1:${functionsPort}`;
const firestoreHost = process.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
const firestorePort = parseInt(process.env.VITE_FIRESTORE_EMULATOR_PORT || '8080', 10);
const firestoreUrl = `http://${firestoreHost}:${firestorePort}`;

const SERVICES = [
  { name: 'Supervisor Frontend (Vite)', port: frontendPort, url: frontendUrl },
  { name: 'Functions Emulator', port: functionsPort, url: functionsUrl },
  { name: 'Firestore Emulator', port: firestorePort, url: firestoreUrl },
];


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
        (res) => {
          resolve({ ok: true, status: res.statusCode });
        }
      );
      req.once('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'Timed out' });
      });
      req.once('error', (err) => resolve({ ok: false, error: err.message }));
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

async function verifyService(svc) {
  if (await probeTcp(svc.port, '127.0.0.1')) return { ...svc, online: true, method: 'TCP (IPv4)' };
  if (await probeTcp(svc.port, '::1')) return { ...svc, online: true, method: 'TCP (IPv6)' };
  const httpRes = await probeHttp(svc.url);
  if (httpRes.ok) return { ...svc, online: true, method: `HTTP (${httpRes.status})` };
  if (isPortListeningInProc(svc.port)) return { ...svc, online: true, method: 'Kernel (/proc/net/tcp)' };
  return { ...svc, online: false, error: httpRes.error || 'Connection refused' };
}

async function main() {
  console.log('\n🔍 [SERVICE CHECK] Inspecting Scriptorium local services...');
  console.log('─'.repeat(70));

  let allOnline = true;
  for (const svc of SERVICES) {
    const res = await verifyService(svc);
    if (res.online) {
      console.log(`  ✅ ${res.name.padEnd(30)} -> ONLINE  via ${res.method} [${res.url}]`);
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
