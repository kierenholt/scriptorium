const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} CustomTestOptions
 * @property {boolean} [isProduction]
 * @property {string} [googleCloudProject]
 * @property {string} [firebaseRegion]
 */

function loadEnvFile(fileName) {
  const envPath = path.resolve(__dirname, '../', fileName);
  const env = {};
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
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

const localEnv = loadEnvFile('.env.local');
const rootEnv = loadEnvFile('.env');
const prodEnv = loadEnvFile('.env.production');

const activeLocalEnv = { ...rootEnv, ...localEnv };

const localProjectId = activeLocalEnv.VITE_FIREBASE_PROJECT_ID || activeLocalEnv.GCP_PROJECT_ID || 'scriptorium-503507';
const prodProjectId = prodEnv.VITE_FIREBASE_PROJECT_ID || 'scriptorium-503507';

/** @type {import('@playwright/test').PlaywrightOptions & CustomTestOptions} */
const localConfig = {
  ...devices['Desktop Chrome'],
  baseURL: activeLocalEnv.LOCAL_BASE_URL || `http://localhost:${activeLocalEnv.PORT || '3000'}`,
  isProduction: false,
  googleCloudProject: localProjectId,
  firebaseRegion: 'europe-west2',
};

if (process.argv.some(arg => String(arg).includes('production'))) {
  process.env.TARGET_ENV = 'production';
  process.env.NODE_ENV = 'production';
  process.env.VITE_USE_EMULATORS = '0';
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.STORAGE_EMULATOR_HOST;
  delete process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
}

/** @type {import('@playwright/test').PlaywrightOptions & CustomTestOptions} */
const productionConfig = {
  ...devices['Desktop Chrome'],
  baseURL: prodEnv.PROD_BASE_URL || `https://${prodProjectId}.web.app`,
  isProduction: true,
  googleCloudProject: prodProjectId,
  firebaseRegion: 'europe-west2',
};

/** @type {import('@playwright/test').PlaywrightTestConfig<CustomTestOptions>} */
module.exports = defineConfig({
  testDir: './',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list']
  ],
  projects: [
    {
      name: 'local',
      use: localConfig,
    },
    {
      name: 'production',
      use: productionConfig,
    },
  ],
});