import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import crypto from 'crypto';
import { GoogleAuth } from 'google-auth-library';
import { serverConfig } from './config';

/**
 * Resolves an authenticated OAuth2 token for Google Cloud Storage.
 */
async function getAccessToken(): Promise<string> {
  const credPath = path.join(os.homedir(), '.config/gcloud/application_default_credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (creds.client_id && creds.refresh_token) {
        const body = new URLSearchParams({
          client_id: creds.client_id,
          client_secret: creds.client_secret,
          refresh_token: creds.refresh_token,
          grant_type: 'refresh_token',
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'identity',
          },
          body: body.toString(),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.access_token) {
            return data.access_token;
          }
        }
      }
    } catch {
      // Fall through to GoogleAuth
    }
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  if (!tokenRes.token) {
    throw new Error('[FAIL FAST] Failed to obtain access token for Google Cloud Storage.');
  }
  return tokenRes.token;
}

/**
 * Returns an authenticated @google-cloud/storage instance.
 */
export async function getStorageClient(): Promise<Storage> {
  const token = await getAccessToken();
  return new Storage({
    projectId: serverConfig.projectId,
    authClient: {
      getRequestHeaders: async () => ({ Authorization: `Bearer ${token}` }),
      getAccessToken: async () => ({ token }),
      projectId: serverConfig.projectId,
    } as any,
  });
}

/**
 * Parse a gs:// URI into bucket and object path.
 */
export function parseGcsUri(gcsUri: string): { bucket: string; objectPath: string } {
  if (!gcsUri || typeof gcsUri !== 'string' || !gcsUri.startsWith('gs://')) {
    throw new Error(`[FAIL FAST] Invalid GCS URI: "${gcsUri}". Must start with "gs://".`);
  }
  const parts = gcsUri.slice(5).split('/');
  const bucket = parts[0];
  const objectPath = parts.slice(1).join('/');
  if (!bucket || !objectPath) {
    throw new Error(`[FAIL FAST] Malformed GCS URI "${gcsUri}". Could not extract bucket and object path.`);
  }
  return { bucket, objectPath };
}

/**
 * Upload a binary buffer to Google Cloud Storage under uploads/ using the @google-cloud/storage npm library.
 */
export async function uploadBufferToGcs(
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ uri: string; size: number }> {
  if (!filename || filename.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory parameter "filename" is missing in uploadBufferToGcs.');
  }
  if (!mimeType || mimeType.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory parameter "mimeType" is missing in uploadBufferToGcs.');
  }
  if (!buffer || buffer.length === 0) {
    throw new Error('[FAIL FAST] Buffer cannot be empty in uploadBufferToGcs.');
  }

  const storage = await getStorageClient();
  const bucket = storage.bucket(serverConfig.uploadsBucket);
  const sanitizedName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const storagePath = `uploads/${uniquePrefix}_${sanitizedName}`;
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        originalFilename: filename,
        uploadedAt: new Date().toISOString(),
      },
    },
    resumable: false,
  });

  const uri = `gs://${bucket.name}/${storagePath}`;
  return { uri, size: buffer.length };
}

/**
 * Download a file buffer from Google Cloud Storage by its gs:// URI using the @google-cloud/storage npm library.
 */
export async function downloadBufferFromGcs(
  gcsUri: string
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const { bucket: bucketName, objectPath } = parseGcsUri(gcsUri);
  const storage = await getStorageClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`[FAIL FAST] File does not exist at GCS path "${gcsUri}".`);
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();

  const mimeType = (metadata.contentType as string) || 'application/octet-stream';
  const filename = path.basename(objectPath);

  return {
    buffer,
    mimeType,
    filename,
  };
}

/**
 * Delete a file from Google Cloud Storage by its gs:// URI using the @google-cloud/storage npm library.
 */
export async function deleteGcsObject(gcsUri: string): Promise<void> {
  const { bucket: bucketName, objectPath } = parseGcsUri(gcsUri);
  const storage = await getStorageClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);

  const [exists] = await file.exists();
  if (exists) {
    await file.delete();
  }
}

/**
 * Promotes and copies an uploaded file into the project artifacts bucket under projects/{projectId}/{filename}.
 */
export async function copyUploadedFileToProjectArtifacts(
  sourceGcsUri: string,
  projectId: string,
  artifactFilename: string,
  customMimeType?: string
): Promise<{ uri: string; size: number; mimeType: string }> {
  if (!sourceGcsUri || sourceGcsUri.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory parameter "sourceGcsUri" is missing in copyUploadedFileToProjectArtifacts.');
  }
  if (!projectId || projectId.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory parameter "projectId" is missing in copyUploadedFileToProjectArtifacts.');
  }
  if (!artifactFilename || artifactFilename.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory parameter "artifactFilename" is missing in copyUploadedFileToProjectArtifacts.');
  }

  const { bucket: srcBucketName, objectPath: srcObjectPath } = parseGcsUri(sourceGcsUri);
  const storage = await getStorageClient();
  const srcBucket = storage.bucket(srcBucketName);
  const srcFile = srcBucket.file(srcObjectPath);

  const [exists] = await srcFile.exists();
  if (!exists) {
    throw new Error(`[FAIL FAST] Source file does not exist at "${sourceGcsUri}".`);
  }

  const destBucket = storage.bucket(serverConfig.projectArtifactsBucket);
  const sanitizedName = path.basename(artifactFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const destPath = `projects/${projectId}/${sanitizedName}`;
  const destFile = destBucket.file(destPath);

  await srcFile.copy(destFile);

  const [metadata] = await destFile.getMetadata();
  const mimeType = customMimeType || (metadata.contentType as string) || 'application/octet-stream';
  if (customMimeType && customMimeType !== metadata.contentType) {
    await destFile.setMetadata({ contentType: customMimeType });
  }

  return {
    uri: `gs://${destBucket.name}/${destPath}`,
    size: Number(metadata.size || 0),
    mimeType,
  };
}

