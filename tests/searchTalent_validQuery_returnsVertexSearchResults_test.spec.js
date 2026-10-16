const crypto = require('crypto');
const { test, expect } = require('./loggingHelper.js');
const { getFunctionUrl } = require('./cloudHelpers.js');
const {
  uploadTestDocument,
  triggerDiscoveryEngineImport,
  cleanupTestDocument
} = require('./testSearchHelpers.js');

test.describe('Search Talent Cloud Function API Integration Tests', () => {
  // Ensure all tests run sequentially
  test.describe.configure({ mode: 'serial' });

  let testDocId = null;
  let originalMetadataContent = null;

  test.afterEach(async () => {
    if (testDocId) {
      await cleanupTestDocument({ testDocId, originalMetadataContent });
      testDocId = null;
    }
  });

  test('searchTalent_validQuery_returnsVertexSearchResults_test', async ({ request, testConfig }) => {
    // Extend timeout for Discovery Engine reindex/import operation and indexing propagation
    test.setTimeout(240000);

    // 1. Generate a random, unique ID and skill identifier that will not appear in any other document
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    testDocId = `test_candidate_${Date.now()}_${randomSuffix}`;
    const uniqueSearchSkill = `SpecialistSkill${randomSuffix}`;
    const testCandidateName = `Candidate ${randomSuffix}`;

    // 2. Upload test document (PDF + metadata.jsonl entry)
    const uploadResult = await uploadTestDocument({
      testDocId,
      name: testCandidateName,
      role: `Staff Solutions Engineer ${uniqueSearchSkill}`,
      skills: `Cloud, Architecture, ${uniqueSearchSkill}`,
      location: 'London',
      years_experience: 8
    });
    originalMetadataContent = uploadResult.originalMetadataContent;

    // 3. Trigger Discovery Engine reindex / import and wait for it to complete
    await triggerDiscoveryEngineImport({ maxWaitMs: 150000 });

    // 4. Call Cloud Function directly (with polling retry to account for search index propagation)
    const searchUrl = getFunctionUrl(testConfig, 'searchTalent');
    let matchingDoc = null;
    let body = null;
    const deadline = Date.now() + 35000;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt++;
      const response = await request.post(searchUrl, {
        data: {
          query: uniqueSearchSkill,
          pageSize: 10
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status()).toBe(200);
      body = await response.json();
      expect(body.success).toBe(true);

      matchingDoc = (body.results || []).find(r => r.id === testDocId);
      if (matchingDoc) {
        console.log(`[Test] Successfully matched document "${testDocId}" on attempt #${attempt}!`);
        break;
      }
      console.log(`[Test] Query attempt #${attempt}: Document not yet visible in search results. Retrying in 4s...`);
      await new Promise(r => setTimeout(r, 4000));
    }

    // 5. Assert against Cloud Function return values
    expect(body.query).toBe(uniqueSearchSkill);
    expect(Array.isArray(body.results)).toBe(true);
    expect(matchingDoc).toBeDefined();
    expect(matchingDoc.id).toBe(testDocId);
    expect(matchingDoc.name).toBe(testCandidateName);
    expect(matchingDoc.skills).toContain(uniqueSearchSkill);
  });

  test('searchTalent_missingQuery_returns400ValidationError_test', async ({ request, testConfig }) => {
    const searchUrl = getFunctionUrl(testConfig, 'searchTalent');

    const response = await request.post(searchUrl, {
      data: {
        query: ''
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('MISSING_QUERY');
    expect(body.message).toContain('Mandatory field "query" is missing');
  });

  test('searchTalent_methodNotAllowed_returns405_test', async ({ request, testConfig }) => {
    const searchUrl = getFunctionUrl(testConfig, 'searchTalent');

    const response = await request.get(searchUrl);

    expect(response.status()).toBe(405);

    const body = await response.json();
    expect(body.error).toBe('METHOD_NOT_ALLOWED');
  });
});
