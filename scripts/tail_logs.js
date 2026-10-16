const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local, .env.development or .env
const localEnvPath = path.join(__dirname, '..', '.env.local');
const devEnvPath = path.join(__dirname, '..', '.env.development');
const rootEnvPath = path.join(__dirname, '..', '.env');
const envPath = fs.existsSync(localEnvPath) ? localEnvPath : (fs.existsSync(devEnvPath) ? devEnvPath : rootEnvPath);
require('dotenv').config({ path: envPath });

const isLocal = process.argv[2] === 'local' || process.argv[2] === 'emulator';

const host = process.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
const port = process.env.VITE_FIRESTORE_EMULATOR_PORT || '8080';
const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'scriptorium-503507';

const dbOptions = { projectId };

if (isLocal) {
  process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;
  console.log(`Connecting to local Firestore emulator (${host}:${port}) for project '${projectId}'...`);
} else {
  console.log(`Connecting to production Firestore database for project '${projectId}'...`);
}

const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore(dbOptions);
const startTime = new Date(); // Start listening for logs from the current moment
let seenExecutions = new Set();

console.log(`Tailing logs from collection 'function_logs' since ${startTime.toISOString()}... Press Ctrl+C to stop.\n`);

const unsubscribe = db.collection('function_logs')
  .where('timestamp', '>=', startTime)
  .onSnapshot(snapshot => {
    const docs = snapshot.docChanges()
      .filter(change => change.type === 'added')
      .map(change => change.doc.data());

    // Sort logs by timestamp client-side to ensure chronological order
    docs.sort((a, b) => {
      const timeA = a.timestamp ? (typeof a.timestamp.toDate === 'function' ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0;
      const timeB = b.timestamp ? (typeof b.timestamp.toDate === 'function' ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0;
      return timeA - timeB;
    });

    docs.forEach(data => {
      const timestampStr = data.timestamp ? (typeof data.timestamp.toDate === 'function' ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) : new Date().toISOString();
      const serviceStr = data.service ? `[${data.service.toUpperCase()}] ` : '';
      const levelStr = `[${data.level ? data.level.toUpperCase() : 'INFO'}]`;
      const messageStr = data.message ? data.message.trim() : '';

      console.log(`[${timestampStr}] ${serviceStr}${levelStr} ${messageStr}`);
      if (data.details) {
        console.log('  Details:', JSON.stringify(data.details, null, 2));
      }

      if (data.executionId && !seenExecutions.has(data.executionId)) {
        seenExecutions.add(data.executionId);
        console.log(`[SYSTEM] New execution flow started: ${data.executionId}`);
      }
    });
  }, err => {
    console.error('Firestore log tailing error:', err);
  });

// Handle graceful exit
process.on('SIGINT', () => {
  console.log('\nStopping log tailing...');
  unsubscribe();
  process.exit(0);
});

