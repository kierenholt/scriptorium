const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { getFunctionUrl, getDb, cleanupTestResources, generateEntityId } = require('./cloudHelpers.js');
const { GoogleAuth } = require('google-auth-library');

/**
 * Generates a valid minimal PDF buffer containing the specified text string.
 */
function createPdfWithText(text) {
  const stream = `BT\n/F1 12 Tf\n100 700 Td\n(${text}) Tj\nET\n`;
  const streamLength = Buffer.byteLength(stream);
  const obj1 = '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n';
  const obj2 = '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n';
  const obj3 = '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n';
  const obj4 = '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n';
  const obj5 = `5 0 obj<</Length ${streamLength}>>stream\n${stream}endstream\nendobj\n`;

  let pdf = '%PDF-1.4\n';
  const offset1 = Buffer.byteLength(pdf);
  pdf += obj1;
  const offset2 = Buffer.byteLength(pdf);
  pdf += obj2;
  const offset3 = Buffer.byteLength(pdf);
  pdf += obj3;
  const offset4 = Buffer.byteLength(pdf);
  pdf += obj4;
  const offset5 = Buffer.byteLength(pdf);
  pdf += obj5;
  const xrefOffset = Buffer.byteLength(pdf);

  const pad = (n) => String(n).padStart(10, '0');
  pdf += 'xref\n0 6\n0000000000 65535 f\n';
  pdf += `${pad(offset1)} 00000 n\n`;
  pdf += `${pad(offset2)} 00000 n\n`;
  pdf += `${pad(offset3)} 00000 n\n`;
  pdf += `${pad(offset4)} 00000 n\n`;
  pdf += `${pad(offset5)} 00000 n\n`;
  pdf += `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

/**
 * Obtains an access token for Google Cloud APIs (ADC or GoogleAuth).
 */
async function getAccessToken() {
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
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (res.ok) {
          const data = await res.json();
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
  return tokenRes.token;
}

/**
 * Cleans up an uploaded object from GCS.
 */
async function deleteUploadedGcsFile(gcsUri) {
  if (!gcsUri || !gcsUri.startsWith('gs://')) return;
  try {
    const parts = gcsUri.slice(5).split('/');
    const bucket = parts[0];
    const objectPath = parts.slice(1).join('/');
    const token = await getAccessToken();
    const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}`;
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.warn(`[Cleanup Warning] Could not delete GCS file ${gcsUri}: ${err.message}`);
  }
}

test.describe('Agent File Upload & Data Extraction Endpoint Tests', () => {
  // Ensure all tests run sequentially
  test.describe.configure({ mode: 'serial' });

  let testProjectId = null;
  const uploadedFilesToClean = [];

  test.afterEach(async ({ testConfig }) => {
    // 1. Delete any GCS files created during test
    for (const gcsUri of uploadedFilesToClean) {
      await deleteUploadedGcsFile(gcsUri);
    }
    uploadedFilesToClean.length = 0;

    // 2. Clean up test Firestore project and messages
    if (testProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [testProjectId],
      });
      testProjectId = null;
    }
  });

  test('chat_textFileUpload_returnsExtracted8DigitId_test', async ({ request, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    // 2. Generate a unique 8-digit ID and unique project ID
    const random8Digits = String(Math.floor(10000000 + Math.random() * 90000000));
    testProjectId = generateEntityId('pr');

    // 3. Seed project record in Firestore via /seed
    const seedUrl = getFunctionUrl(testConfig, 'seed');
    const seedRes = await request.post(seedUrl, {
      data: { projectId: testProjectId },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(seedRes.status()).toBe(200);

    // 4. Create synthetic text file containing the 8-digit ID
    const fileContent = `--- Scriptorium Candidate Dossier ---\nCandidate Reference: ${random8Digits}\nRole: French Transcreation Specialist\nVetting Status: Approved\nYears of Experience: 7\n`;
    const base64Content = Buffer.from(fileContent, 'utf8').toString('base64');

    // 5. Upload file via /upload endpoint
    const uploadUrl = getFunctionUrl(testConfig, 'upload');
    const uploadRes = await request.post(uploadUrl, {
      data: {
        filename: `candidate_${random8Digits}.txt`,
        mimeType: 'text/plain',
        content: base64Content,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(uploadRes.status()).toBe(200);
    const uploadData = await uploadRes.json();
    expect(uploadData.success).toBe(true);
    expect(uploadData.uri).toContain('gs://');
    uploadedFilesToClean.push(uploadData.uri);

    // 6. Query the agent via /chat endpoint with attached fileUri
    const chatUrl = getFunctionUrl(testConfig, 'chat');
    const chatRes = await request.post(chatUrl, {
      data: {
        projectId: testProjectId,
        message: 'Read the attached candidate document. Find the 8-digit candidate reference ID and return ONLY that 8-digit ID.',
        fileUri: uploadData.uri,
        fileMimeType: 'text/plain',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(chatRes.status()).toBe(200);

    // 7. Verify the SSE stream completed
    const sseResponseText = await chatRes.text();
    expect(sseResponseText).toContain('event: done');

    // 8. Fetch the persisted agent response from Firestore projects/{projectId}/messages
    const db = getDb(testConfig);
    const messagesSnap = await db
      .collection('projects')
      .doc(testProjectId)
      .collection('messages')
      .where('sender', '==', 'agent')
      .get();

    expect(messagesSnap.empty).toBe(false);
    const agentMessage = messagesSnap.docs[0].data();
    expect(agentMessage.content).toBeDefined();

    // 9. Assert that the agent response contains the exact 8-digit ID
    const idRegex = new RegExp(`\\b${random8Digits}\\b`);
    expect(agentMessage.content).toMatch(idRegex);
  });

  test('chat_pdfFileUpload_returnsExtracted8DigitId_test', async ({ request, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    // 2. Generate a unique 8-digit ID and unique project ID
    const random8Digits = String(Math.floor(10000000 + Math.random() * 90000000));
    testProjectId = generateEntityId('pr');

    // 3. Seed project record in Firestore via /seed
    const seedUrl = getFunctionUrl(testConfig, 'seed');
    const seedRes = await request.post(seedUrl, {
      data: { projectId: testProjectId },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(seedRes.status()).toBe(200);

    // 4. Create synthetic minimal valid PDF containing the 8-digit ID
    const pdfBuffer = createPdfWithText(`Candidate Reference ID: ${random8Digits}`);
    const base64Content = pdfBuffer.toString('base64');

    // 5. Upload file via /upload endpoint
    const uploadUrl = getFunctionUrl(testConfig, 'upload');
    const uploadRes = await request.post(uploadUrl, {
      data: {
        filename: `candidate_profile_${random8Digits}.pdf`,
        mimeType: 'application/pdf',
        content: base64Content,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(uploadRes.status()).toBe(200);
    const uploadData = await uploadRes.json();
    expect(uploadData.success).toBe(true);
    expect(uploadData.uri).toContain('gs://');
    uploadedFilesToClean.push(uploadData.uri);

    // 6. Query the agent via /chat endpoint with attached fileUri
    const chatUrl = getFunctionUrl(testConfig, 'chat');
    const chatRes = await request.post(chatUrl, {
      data: {
        projectId: testProjectId,
        message: 'Read the attached PDF document. Locate the 8-digit candidate reference ID and output ONLY that 8-digit ID.',
        fileUri: uploadData.uri,
        fileMimeType: 'application/pdf',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(chatRes.status()).toBe(200);

    // 7. Verify the SSE stream completed
    const sseResponseText = await chatRes.text();
    expect(sseResponseText).toContain('event: done');

    // 8. Fetch the persisted agent response from Firestore
    const db = getDb(testConfig);
    const messagesSnap = await db
      .collection('projects')
      .doc(testProjectId)
      .collection('messages')
      .where('sender', '==', 'agent')
      .get();

    expect(messagesSnap.empty).toBe(false);
    const agentMessage = messagesSnap.docs[0].data();
    expect(agentMessage.content).toBeDefined();

    // 9. Assert that the agent response contains the exact 8-digit ID
    const idRegex = new RegExp(`\\b${random8Digits}\\b`);
    expect(agentMessage.content).toMatch(idRegex);
  });
});
