/**
 * Client Configuration with Fail-Fast Environment Validation.
 * Throws explicit errors immediately if mandatory configuration is missing.
 */

function requireEnv(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[FAIL FAST] Mandatory environment variable "${key}" is missing or empty. Please check your frontend .env configuration.`
    );
  }
  return value.trim();
}

export const config = {
  firebase: {
    apiKey: requireEnv('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID),
    messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: requireEnv('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID),
  },
  apiBaseUrl: requireEnv('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
  projectId: requireEnv('VITE_PROJECT_ID', import.meta.env.VITE_PROJECT_ID),
  useEmulator: requireEnv('VITE_USE_EMULATOR', import.meta.env.VITE_USE_EMULATOR) === 'true',
  firestoreEmulatorHost: import.meta.env.VITE_USE_EMULATOR === 'true'
    ? requireEnv('VITE_FIRESTORE_EMULATOR_HOST', import.meta.env.VITE_FIRESTORE_EMULATOR_HOST)
    : '',
  firestoreEmulatorPort: import.meta.env.VITE_USE_EMULATOR === 'true'
    ? (() => {
        const port = parseInt(requireEnv('VITE_FIRESTORE_EMULATOR_PORT', import.meta.env.VITE_FIRESTORE_EMULATOR_PORT), 10);
        if (isNaN(port)) {
          throw new Error('[FAIL FAST] VITE_FIRESTORE_EMULATOR_PORT must be a valid number.');
        }
        return port;
      })()
    : 0,
} as const;
