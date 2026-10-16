#!/usr/bin/env node

/**
 * Service Health Check Script
 * Resilient multi-method check (TCP socket -> HTTP -> /proc/net/tcp) for local services.
 */

const http = require('http');
const net = require('net');
const fs = require('fs');

const SERVICES = [
  { name: 'Supervisor Frontend (Vite)', port: 3000, url: 'http://localhost:3000' },
  { name: 'Functions Emulator', port: 5001, url: 'http://127.0.0.1:5001' },
  { name: 'Firestore Emulator', port: 8080, url: 'http://127.0.0.1:8080' },
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
