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
  const setMock = vi.fn().mockResolvedValue({});
  const deleteMock = vi.fn().mockResolvedValue({});
  const docRef = {
    delete: deleteMock,
    set: setMock,
    update: updateMock,
  };
  const getMock = vi.fn().mockResolvedValue({
    exists: true,
    id: 'em-a1b2c3',
    ref: docRef,
    data: () => ({
      id: 'pr-7k4x9q',
      title: 'Sample Project',
      subject: 'Sample Subject',
      emails: [],
      artifacts: [
        {
          id: 'ar-8m2p9k',
          name: 'Project_Brief.pdf',
          comment: 'Approved audit brief',
          gcsUri: 'gs://scriptorium-project-artifacts-503507/projects/pr-7k4x9q/Project_Brief.pdf',
          mimeType: 'application/pdf',
          createdAt: new Date().toISOString(),
          createdBy: 'agent',
        },
      ],
    }),
  });
  const subDocMock = vi.fn(() => ({
    set: setMock,
    update: updateMock,
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'sl-123456',
        name: 'Alice',
        role: 'Copywriter',
        status: 'shortlisted',
      }),
    }),
    delete: deleteMock,
  }));
  const subCollectionMock = vi.fn(() => ({
    doc: subDocMock,
    where: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ docs: [], forEach: vi.fn() }),
      })),
    })),
    limit: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({ docs: [], forEach: vi.fn() }),
    })),
    get: vi.fn().mockResolvedValue({ docs: [], forEach: vi.fn() }),
  }));

  const docMock = vi.fn(() => ({
    update: updateMock,
    set: setMock,
    delete: deleteMock,
    get: getMock,
    collection: subCollectionMock,
  }));
  const collectionMock = vi.fn(() => ({
    doc: docMock,
    orderBy: vi.fn(() => ({
      limit: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          docs: [
            {
              id: 'pr-7k4x9q',
              data: () => ({
                title: 'Sample Project',
                status: 'draft',
                tags: ['mvp'],
                updatedAt: new Date().toISOString(),
              }),
            },
          ],
        }),
      })),
    })),
  }));
  return {
    db: {
      collection: collectionMock,
    },
  };
});

// Mock vertexSearch for dispatch tests
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

// Mock storage for dispatch tests
vi.mock('../src/storage', () => ({
  copyUploadedFileToProjectArtifacts: vi.fn().mockResolvedValue({
    uri: 'gs://scriptorium-project-artifacts-503507/projects/pr-7k4x9q/Brief.pdf',
    size: 1024,
    mimeType: 'application/pdf',
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
    'readCandidateEmailMessage',
    'sendCandidateEmailMessage',
    'saveProjectArtifact',
    'getProjectArtifactDownloadUrl',
    'lookupProjectRecord',
    'listRecentProjects',
    'lookupProjectArtifact',
    'getProjectsFromEmailSender',
    'assignEmailToProject',
    'listUnassignedInboxEmails',
    'deleteCandidateEmailMessage',
    'shortlistCandidateForProject',
    'listShortlistedTalentsForProject',
    'updateShortlistedTalentStatus',
    'removeShortlistedTalentFromProject',
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
    const stageResult = await dispatchToolCall('pr-7k4x9q', 'updateProjectLifecycleStage', { status: 'in_progress' });
    expect(stageResult.success).toBe(true);

    // 2. Test renameProjectDocument
    const renameResult = await dispatchToolCall('pr-7k4x9q', 'renameProjectDocument', { title: 'New Title' });
    expect(renameResult.success).toBe(true);

    // 3. Test updateProjectBriefDescription
    const descResult = await dispatchToolCall('pr-7k4x9q', 'updateProjectBriefDescription', { description: 'Updated brief' });
    expect(descResult.success).toBe(true);

    // 4. Test addProjectRequirementTag
    const addTagResult = await dispatchToolCall('pr-7k4x9q', 'addProjectRequirementTag', { tag: 'transcreation' });
    expect(addTagResult.success).toBe(true);

    // 5. Test removeProjectRequirementTag
    const removeTagResult = await dispatchToolCall('pr-7k4x9q', 'removeProjectRequirementTag', { tag: 'transcreation' });
    expect(removeTagResult.success).toBe(true);

    // 6. Test searchTalentPool
    const searchResult = await dispatchToolCall('pr-7k4x9q', 'searchTalentPool', { query: 'copywriter' });
    expect(searchResult.success).toBe(true);
    expect(searchResult.data).toHaveProperty('candidates');

    // 7. Test indexTalentCv
    const indexResult = await dispatchToolCall('pr-7k4x9q', 'indexTalentCv', {
      name: 'Alice',
      role: 'Senior Copywriter',
      skills: 'Copywriting, Transcreation',
    });
    expect(indexResult.success).toBe(true);
    expect(indexResult.data).toHaveProperty('documentId');

    // 8. Test indexTalentProfile alias
    const aliasIndexResult = await dispatchToolCall('pr-7k4x9q', 'indexTalentProfile', {
      name: 'Bob',
      role: 'AI Post-Editor',
      skills: 'MTPE, French',
    });
    expect(aliasIndexResult.success).toBe(true);

    // 9. Verify backwards compatibility for legacy aliases
    const legacyStatusResult = await dispatchToolCall('pr-7k4x9q', 'updateStatus', { status: 'completed' });
    expect(legacyStatusResult.success).toBe(true);

    const legacyRenameResult = await dispatchToolCall('pr-7k4x9q', 'renameProject', { title: 'Legacy Title' });
    expect(legacyRenameResult.success).toBe(true);

    // 10. Test readCandidateEmailMessage
    const readEmailResult = await dispatchToolCall('pr-7k4x9q', 'readCandidateEmailMessage', { query: 'test' });
    expect(readEmailResult).toBeDefined();
    expect(typeof readEmailResult.success).toBe('boolean');

    // 11. Test sendCandidateEmailMessage
    const sendEmailResult = await dispatchToolCall('pr-7k4x9q', 'sendCandidateEmailMessage', {
      to: 'delivered@resend.dev',
      subject: 'Test Subject',
      body: 'Test Body',
    });
    expect(sendEmailResult).toBeDefined();
    expect(typeof sendEmailResult.success).toBe('boolean');

    // 12. Test saveProjectArtifact
    const saveArtifactResult = await dispatchToolCall('pr-7k4x9q', 'saveProjectArtifact', {
      sourceFileUri: 'gs://scriptorium-uploads-503507/uploads/brief.pdf',
      artifactName: 'Project_Brief.pdf',
      mimeType: 'application/pdf',
      comment: 'Initial client brief',
    });
    expect(saveArtifactResult.success).toBe(true);
    expect(saveArtifactResult.data).toHaveProperty('artifact');

    // 13. Test getProjectArtifactDownloadUrl
    const getArtifactResult = await dispatchToolCall('pr-7k4x9q', 'getProjectArtifactDownloadUrl', {
      query: 'audit',
    });
    expect(getArtifactResult.success).toBe(true);
    expect(getArtifactResult.data).toHaveProperty('downloadUrl');
    expect(getArtifactResult.data).toHaveProperty('artifact');

    // 14. Test lookupProjectRecord
    const lookupProjResult = await dispatchToolCall('pr-7k4x9q', 'lookupProjectRecord', {
      projectId: 'pr-7k4x9q',
    });
    expect(lookupProjResult.success).toBe(true);
    expect(lookupProjResult.data).toHaveProperty('project');

    // 15. Test listRecentProjects
    const listProjResult = await dispatchToolCall('pr-7k4x9q', 'listRecentProjects', {
      limit: 5,
    });
    expect(listProjResult.success).toBe(true);
    expect(listProjResult.data).toHaveProperty('projects');

    // 16. Test lookupProjectArtifact
    const lookupArtResult = await dispatchToolCall('pr-7k4x9q', 'lookupProjectArtifact', {
      artifactId: 'ar-8m2p9k',
    });
    expect(lookupArtResult.success).toBe(true);
    expect(lookupArtResult.data).toHaveProperty('artifact');

    // 17. Test shortlistCandidateForProject
    const shortlistResult = await dispatchToolCall('pr-7k4x9q', 'shortlistCandidateForProject', {
      name: 'Elena Rostova',
      role: 'Senior Transcreation Specialist',
      status: 'shortlisted',
      dayRate: '£450',
    });
    expect(shortlistResult.success).toBe(true);
    expect(shortlistResult.data).toHaveProperty('id');

    // 18. Test listShortlistedTalentsForProject
    const listShortlistResult = await dispatchToolCall('pr-7k4x9q', 'listShortlistedTalentsForProject', {
      status: 'shortlisted',
    });
    expect(listShortlistResult.success).toBe(true);
    expect(listShortlistResult.data).toHaveProperty('shortlistedTalents');

    // 19. Test updateShortlistedTalentStatus
    const updateShortlistResult = await dispatchToolCall('pr-7k4x9q', 'updateShortlistedTalentStatus', {
      shortlistId: 'sl-123456',
      status: 'booked',
    });
    expect(updateShortlistResult.success).toBe(true);

    // 20. Test removeShortlistedTalentFromProject
    const removeShortlistResult = await dispatchToolCall('pr-7k4x9q', 'removeShortlistedTalentFromProject', {
      shortlistId: 'sl-123456',
    });
    expect(removeShortlistResult.success).toBe(true);

    // 21. Test deleteCandidateEmailMessage
    const deleteEmailResult = await dispatchToolCall('pr-7k4x9q', 'deleteCandidateEmailMessage', {
      emailId: 'em-a1b2c3',
    });
    expect(deleteEmailResult.success).toBe(true);
    expect(deleteEmailResult.data).toHaveProperty('emailId');

    // 22. Test deleteEmail alias
    const deleteAliasResult = await dispatchToolCall('pr-7k4x9q', 'deleteEmail', {
      emailId: 'em-a1b2c3',
    });
    expect(deleteAliasResult.success).toBe(true);
  });
});

