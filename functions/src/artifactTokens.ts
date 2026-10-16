import crypto from 'crypto';
import { serverConfig } from './config';

function getSigningSecret(): string {
  const secret = process.env.DOWNLOAD_SIGNING_SECRET || serverConfig.geminiApiKey;
  if (!secret || secret.trim() === '') {
    throw new Error('[FAIL FAST] Mandatory signing secret is missing for artifact download tokens.');
  }
  return secret.trim();
}

/**
 * Generates an HMAC SHA-256 signature for a timeboxed project artifact download link.
 */
export function generateArtifactDownloadToken(projectId: string, artifactId: string, expires: number): string {
  const secret = getSigningSecret();
  const payload = `${projectId}:${artifactId}:${expires}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Validates the timeboxed signature and ensures the link has not expired.
 */
export function verifyArtifactDownloadToken(
  projectId: string,
  artifactId: string,
  expires: number,
  signature: string
): { valid: boolean; reason?: string } {
  if (!signature || typeof signature !== 'string') {
    return { valid: false, reason: 'Missing signature.' };
  }

  const now = Date.now();
  if (now > expires) {
    return { valid: false, reason: 'Download link has expired.' };
  }

  const expectedSignature = generateArtifactDownloadToken(projectId, artifactId, expires);

  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false, reason: 'Invalid signature.' };
  }

  return { valid: true };
}

/**
 * Builds the complete timeboxed download URL for a project artifact.
 */
export function buildArtifactDownloadUrl(
  baseUrl: string,
  projectId: string,
  artifactId: string,
  expiresInMinutes: number = 15
): { url: string; expiresAt: string } {
  const expires = Date.now() + Math.max(1, expiresInMinutes) * 60 * 1000;
  const signature = generateArtifactDownloadToken(projectId, artifactId, expires);
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const url = `${cleanBase}/downloadArtifact?projectId=${encodeURIComponent(projectId)}&artifactId=${encodeURIComponent(artifactId)}&expires=${expires}&signature=${signature}`;
  return {
    url,
    expiresAt: new Date(expires).toISOString(),
  };
}
