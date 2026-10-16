import { describe, it, expect } from 'vitest';
import {
  generateEntityId,
  isValidEntityId,
  assertValidEntityId,
  ENTITY_PREFIX_TAXONOMY,
  EntityPrefix,
} from '../src/entityId';

describe('generateEntityId_allPrefixes_conformsToStrictAlphanumericFormat_test', () => {
  it('generateEntityId_allTaxonomyPrefixes_matchesStrictAlphanumericFormat_test', () => {
    const prefixes = Object.keys(ENTITY_PREFIX_TAXONOMY) as EntityPrefix[];
    expect(prefixes).toEqual(['pr', 'ms', 'em', 'ar', 'tl']);

    for (const prefix of prefixes) {
      for (let i = 0; i < 20; i++) {
        const id = generateEntityId(prefix);
        expect(id).toMatch(new RegExp(`^${prefix}-[a-z0-9]{6}$`));
        expect(isValidEntityId(id, prefix)).toBe(true);
        expect(isValidEntityId(id)).toBe(true);
        expect(() => assertValidEntityId(id, prefix)).not.toThrow();
      }
    }
  });

  it('generateEntityId_invalidPrefix_throwsExplicitFailFastError_test', () => {
    expect(() => generateEntityId('xx' as any)).toThrow(
      /\[FAIL FAST\] Invalid entity prefix "xx"/
    );
  });

  it('isValidEntityId_invalidFormats_returnsFalse_test', () => {
    expect(isValidEntityId('')).toBe(false);
    expect(isValidEntityId(null as any)).toBe(false);
    expect(isValidEntityId('project-default')).toBe(false);
    expect(isValidEntityId('pr-12345')).toBe(false); // only 5 chars
    expect(isValidEntityId('pr-1234567')).toBe(false); // 7 chars
    expect(isValidEntityId('pr-12345_')).toBe(false); // underscore
    expect(isValidEntityId('PR-ABCDEF')).toBe(false); // uppercase
    expect(isValidEntityId('pr-7k4x9q', 'ms')).toBe(false); // prefix mismatch
  });

  it('assertValidEntityId_invalidId_throwsExplicitFailFastError_test', () => {
    expect(() => assertValidEntityId('project-default', 'pr')).toThrow(
      /\[FAIL FAST\] Invalid entity ID "project-default"/
    );
    expect(() => assertValidEntityId('', 'pr')).toThrow(
      /\[FAIL FAST\] Missing entity ID/
    );
    expect(() => assertValidEntityId('ms-123456', 'pr')).toThrow(
      /\[FAIL FAST\] Invalid entity ID "ms-123456"/
    );
  });
});
