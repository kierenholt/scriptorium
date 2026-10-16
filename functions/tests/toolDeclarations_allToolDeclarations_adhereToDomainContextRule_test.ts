import { describe, it, expect, vi } from 'vitest';
import {
  allToolDeclarations,
  updateProjectLifecycleStageDeclaration,
  renameProjectDocumentDeclaration,
  updateProjectBriefDescriptionDeclaration,
  addProjectRequirementTagDeclaration,
  removeProjectRequirementTagDeclaration,
  searchTalentPoolDeclaration,
  indexTalentCvDeclaration,
} from '../src/tools/declarations';
import { dispatchToolCall } from '../src/tools/executors';

// Mock db for dispatch tests
vi.mock('../src/firestore', () => {
  const updateMock = vi.fn().mockResolvedValue({});
  const docMock = vi.fn(() => ({ update: updateMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  return {
    db: {
      collection: collectionMock,
    },
  };
});

// Mock searchVertexAI and indexVertexDocument for dispatch tests
vi.mock('../src/vertexSearch', () => ({
  searchVertexAI: vi.fn().mockResolvedValue({
    success: true,
    query: 'copywriter',
    results: [{ id: 'cand-1', name: 'Alice', role: 'Copywriter' }],
  }),
  indexVertexDocument: vi.fn().mockResolvedValue({
    success: true,
    documentId: 'talent_alice_123',
    message: 'Candidate "Alice" successfully indexed into Vertex AI datastore.',
  }),
}));

describe('toolDeclarations_allToolDeclarations_adhereToDomainContextRule_test', () => {
  const EXPECTED_TOOL_NAMES = [
    'updateProjectLifecycleStage',
    'renameProjectDocument',
    'updateProjectBriefDescription',
    'addProjectRequirementTag',
    'removeProjectRequirementTag',
    'searchTalentPool',
    'indexTalentCv',
  ];

  const FORBIDDEN_GENERIC_NAMES = [
    'updateStatus',
    'renameProject',
    'updateDescription',
    'addTag',
    'removeTag',
    'addDocument',
    'updateDocument',
    'deleteDocument',
    'searchVertex',
  ];

  it('toolDeclarations_allToolDeclarations_containsOnlyDomainContextualTools_test', () => {
    const activeNames = allToolDeclarations.map((t) => t.name);

    expect(activeNames).toEqual(expect.arrayContaining(EXPECTED_TOOL_NAMES));
    expect(activeNames.length).toBe(EXPECTED_TOOL_NAMES.length);

    // Verify none of the active declarations use forbidden generic names
    for (const forbiddenName of FORBIDDEN_GENERIC_NAMES) {
      expect(activeNames).not.toContain(forbiddenName);
    }
  });

  it('toolDeclarations_allToolDeclarations_enforceThreePartDescriptionSchema_test', () => {
    for (const tool of allToolDeclarations) {
      expect(tool.description).toBeDefined();
      const desc = tool.description as string;

      // 1. Business Intent: Must explain domain purpose (mentions Scriptorium, project, talent, candidate, etc.)
      const hasDomainContext = /Scriptorium|project|talent|candidate|discipline|competenc/i.test(desc);
      expect(
        hasDomainContext,
        `Tool "${tool.name}" description must convey domain business context.`
      ).toBe(true);

      // 2. User Trigger Phrases: Must contain explicit user conversational trigger phrasing
      const hasTriggerPhrases = /Use when the supervisor|Use when/i.test(desc);
      expect(
        hasTriggerPhrases,
        `Tool "${tool.name}" description must contain user trigger phrasing (e.g. "Use when...").`
      ).toBe(true);

      // 3. Negative Guardrails: Must explicitly exclude inappropriate actions
      const hasGuardrails = /Do NOT use/i.test(desc);
      expect(
        hasGuardrails,
        `Tool "${tool.name}" description must specify negative guardrails (e.g. "Do NOT use this tool for...").`
      ).toBe(true);
    }
  });

  it('toolDeclarations_allParameters_haveDomainDescriptions_test', () => {
    for (const tool of allToolDeclarations) {
      const properties = (tool.parameters as any)?.properties || {};
      for (const [propName, propDef] of Object.entries<any>(properties)) {
        expect(
          propDef.description,
          `Tool "${tool.name}" parameter "${propName}" must have a descriptive domain comment.`
        ).toBeDefined();
        expect(propDef.description.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('dispatchToolCall_domainToolNames_routesCorrectly_test', async () => {
    // 1. Test updateProjectLifecycleStage
    const stageResult = await dispatchToolCall('proj-1', 'updateProjectLifecycleStage', { status: 'in_progress' });
    expect(stageResult.success).toBe(true);

    // 2. Test renameProjectDocument
    const renameResult = await dispatchToolCall('proj-1', 'renameProjectDocument', { title: 'New Title' });
    expect(renameResult.success).toBe(true);

    // 3. Test updateProjectBriefDescription
    const descResult = await dispatchToolCall('proj-1', 'updateProjectBriefDescription', { description: 'Updated brief' });
    expect(descResult.success).toBe(true);

    // 4. Test addProjectRequirementTag
    const addTagResult = await dispatchToolCall('proj-1', 'addProjectRequirementTag', { tag: 'transcreation' });
    expect(addTagResult.success).toBe(true);

    // 5. Test removeProjectRequirementTag
    const removeTagResult = await dispatchToolCall('proj-1', 'removeProjectRequirementTag', { tag: 'transcreation' });
    expect(removeTagResult.success).toBe(true);

    // 6. Test searchTalentPool
    const searchResult = await dispatchToolCall('proj-1', 'searchTalentPool', { query: 'copywriter' });
    expect(searchResult.success).toBe(true);
    expect(searchResult.data).toHaveProperty('candidates');

    // 7. Test indexTalentCv
    const indexResult = await dispatchToolCall('proj-1', 'indexTalentCv', {
      name: 'Alice',
      role: 'Senior Copywriter',
      skills: 'Copywriting, Transcreation',
    });
    expect(indexResult.success).toBe(true);
    expect(indexResult.data).toHaveProperty('documentId');

    // 8. Test indexTalentProfile alias
    const aliasIndexResult = await dispatchToolCall('proj-1', 'indexTalentProfile', {
      name: 'Bob',
      role: 'AI Post-Editor',
      skills: 'MTPE, French',
    });
    expect(aliasIndexResult.success).toBe(true);

    // 9. Verify backwards compatibility for legacy aliases
    const legacyStatusResult = await dispatchToolCall('proj-1', 'updateStatus', { status: 'completed' });
    expect(legacyStatusResult.success).toBe(true);

    const legacyRenameResult = await dispatchToolCall('proj-1', 'renameProject', { title: 'Legacy Title' });
    expect(legacyRenameResult.success).toBe(true);
  });
});
