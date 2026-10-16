import * as dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(
      `[FAIL FAST] Mandatory environment variable "${key}" is missing. Please set it in functions/.env or Cloud environment.`
    );
  }
  return value.trim();
}

export const serverConfig = {
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  projectId: process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT || 'scriptorium-503507',
  modelName: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  vertexSearchProjectNumber: requireEnv('VERTEX_SEARCH_PROJECT_NUMBER'),
  vertexSearchDatastoreId: requireEnv('VERTEX_SEARCH_DATASTORE_ID'),
  vertexSearchLocation: process.env.VERTEX_SEARCH_LOCATION || 'eu',
  storageBucket: requireEnv('AI_SEARCHABLE_BUCKET'),
  uploadsBucket: requireEnv('AI_UPLOADS_BUCKET'),
  projectArtifactsBucket: requireEnv('PROJECT_ARTIFACTS_BUCKET'),
  functionsBaseUrl:
    process.env.FUNCTIONS_BASE_URL ||
    (process.env.FUNCTIONS_EMULATOR
      ? `http://127.0.0.1:5001/${process.env.GCP_PROJECT_ID || 'scriptorium-503507'}/europe-west2`
      : `https://europe-west2-${process.env.GCP_PROJECT_ID || 'scriptorium-503507'}.cloudfunctions.net`),
  defaultProjectId: process.env.VITE_PROJECT_ID || process.env.DEFAULT_PROJECT_ID || 'pr-7k4x9q',
};
