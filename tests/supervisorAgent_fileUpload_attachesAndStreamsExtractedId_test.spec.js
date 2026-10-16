const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources, getDb, generateEntityId, seedTestProject } = require('./cloudHelpers.js');

test.describe('Supervisor Console File Upload E2E Browser Flow', () => {
  // Ensure all tests run sequentially
  test.describe.configure({ mode: 'serial' });

  let testProjectId = null;
  let tempFilePath = null;

  test.afterEach(async ({ testConfig }) => {
    // 1. Remove local temp test file if created
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        // Continue
      }
      tempFilePath = null;
    }

    // 2. Clean up Firestore project record and messages
    if (testProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [testProjectId],
      });
      testProjectId = null;
    }
  });

  test('supervisorAgent_fileUpload_attachesAndStreamsExtractedId_test', async ({ page, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    // 2. Generate unique 8-digit reference ID and project ID
    const random8Digits = String(Math.floor(10000000 + Math.random() * 90000000));
    testProjectId = generateEntityId('pr');

    // 3. Create a temporary local text file with candidate details
    const tempFileName = `candidate_dossier_${random8Digits}.txt`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    const candidateFileContent = `=== Scriptorium Candidate Profile ===\nCandidate Name: Elena Rostova\nReference ID: ${random8Digits}\nPrimary Role: Lead Transcreation Specialist\nLanguage Pairs: EN->FR, EN->DE\nYears of Experience: 8\nCraft Evaluation: Highly recommended\n`;
    fs.writeFileSync(tempFilePath, candidateFileContent, 'utf8');

    // 4. Seed project record in Firestore via API
    await seedTestProject(testConfig, testProjectId);

    // 5. Navigate to Supervisor Console SPA
    await page.goto(`/?projectId=${testProjectId}`);

    // 6. Verify the Structured Inspector reflects seeded project
    const statusBadge = page.locator('[data-testid="project-status-badge"]');
    await expect(statusBadge).toBeVisible({ timeout: 15000 });
    await expect(statusBadge).toContainText('draft');

    // 7. Attach candidate file using file input
    const fileUploadBtn = page.locator('[data-testid="file-upload-btn"]');
    await expect(fileUploadBtn).toBeVisible();

    const fileInput = page.locator('[data-testid="file-upload-input"]');
    await fileInput.setInputFiles(tempFilePath);

    // 8. Verify attachment preview chip appears and indicates upload complete
    const attachedChip = page.locator('[data-testid="attached-file-chip"]');
    await expect(attachedChip).toBeVisible({ timeout: 15000 });
    await expect(attachedChip).toContainText(tempFileName);
    await expect(attachedChip).toContainText('Uploaded', { timeout: 20000 });

    // 9. Command the agent in the chat input
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Find the 8-digit candidate reference ID in the attached document and return ONLY that ID.');

    // 10. Click Send command
    const sendBtn = page.locator('[data-testid="chat-send-btn"]');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 11. Verify user message bubble renders with file attachment indicator
    const userAttachmentChip = page.locator('[data-testid="message-file-attachment"]');
    await expect(userAttachmentChip).toBeVisible({ timeout: 10000 });
    await expect(userAttachmentChip).toContainText(tempFileName);

    // 12. Wait for the agent to stream response and re-enable chat input
    await expect(chatInput).toBeEnabled({ timeout: 45000 });

    // 13. Verify no execution error occurred
    const errorAlert = page.locator('text=Execution Error');
    await expect(errorAlert).not.toBeVisible();

    // 14. Assert that the agent response in the chat panel contains the exact 8-digit ID
    const chatWindow = page.locator('[data-testid="chat-window"]');
    await expect(chatWindow).toContainText(random8Digits);

    // 15. Verify persistence in Firestore projects/{projectId}/messages
    const db = getDb(testConfig);
    const messagesSnap = await db
      .collection('projects')
      .doc(testProjectId)
      .collection('messages')
      .where('sender', '==', 'agent')
      .get();

    expect(messagesSnap.empty).toBe(false);
    const agentMsg = messagesSnap.docs[0].data();
    expect(agentMsg.content).toBeDefined();
    const idRegex = new RegExp(`\\b${random8Digits}\\b`);
    expect(agentMsg.content).toMatch(idRegex);
  });
});
