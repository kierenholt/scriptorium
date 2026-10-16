import * as crypto from 'crypto';

export type EntityPrefix = 'pr' | 'ms' | 'em' | 'ar' | 'tl';

export const ENTITY_PREFIX_TAXONOMY: Record<EntityPrefix, { collection: string; description: string }> = {
  pr: { collection: 'projects', description: 'Project document record (projects/{projectId})' },
  ms: { collection: 'messages', description: 'Chat conversation message record (projects/{projectId}/messages/{messageId})' },
  em: { collection: 'emails', description: 'Candidate/client outbound or inbound email communication (emails/{emailId})' },
  ar: { collection: 'artifacts', description: 'Project deliverable or dossier artifact ID (project.artifacts[].id)' },
  tl: { collection: 'talent', description: 'Candidate CV profile or Discovery Engine datastore record' },
};

const ALPHANUMERIC_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a cryptographically random entity ID adhering to the 2-letter + 6-character alphanumeric convention:
 * Format: [a-z]{2}-[a-z0-9]{6}
 * Example: pr-7k4x9q, em-w8m2a1, ms-p3k9v0
 */
export function generateEntityId(prefix: EntityPrefix): string {
  if (!ENTITY_PREFIX_TAXONOMY[prefix]) {
    throw new Error(
      `[FAIL FAST] Invalid entity prefix "${prefix}". Allowed entity prefixes: ${Object.keys(ENTITY_PREFIX_TAXONOMY).join(', ')}.`
    );
  }

  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += ALPHANUMERIC_CHARS[bytes[i] % ALPHANUMERIC_CHARS.length];
  }

  return `${prefix}-${suffix}`;
}

/**
 * Check whether a given ID string adheres strictly to the entity ID convention:
 * 2 lowercase letters followed by hyphen and 6 lowercase alphanumeric characters.
 * Optionally validates against an expected prefix.
 */
export function isValidEntityId(id: string, prefix?: EntityPrefix): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  const trimmed = id.trim();
  if (prefix) {
    const prefixRegex = new RegExp(`^${prefix}-[a-z0-9]{6}$`);
    return prefixRegex.test(trimmed);
  }

  return /^[a-z]{2}-[a-z0-9]{6}$/.test(trimmed);
}

/**
 * Assert that an ID is valid, throwing an explicit error if validation fails (Fail-Fast).
 */
export function assertValidEntityId(id: string, prefix?: EntityPrefix): void {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new Error(
      `[FAIL FAST] Missing entity ID. Expected valid ${prefix ? `"${prefix}-XXXXXX"` : '"[a-z]{2}-[a-z0-9]{6}"'} identifier.`
    );
  }

  const trimmed = id.trim();
  if (!isValidEntityId(trimmed, prefix)) {
    throw new Error(
      `[FAIL FAST] Invalid entity ID "${trimmed}". All entity IDs must strictly follow the format: ${
        prefix ? `"${prefix}-XXXXXX"` : '"[a-z]{2}-[a-z0-9]{6}"'
      } (two lowercase letters, hyphen, and six lowercase alphanumeric characters).`
    );
  }
}
