const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources, getDb, generateEntityId, seedTestProject } = require('./cloudHelpers.js');

test.describe('Supervisor Console Project Artifact Lifecycle & Secure Download E2E Flow', () => {
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

  test('supervisorAgent_projectArtifactLifecycle_uploadsPersistsAndDownloadsWithSignedUrl_test', async ({ page, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    // 2. Generate unique 8-digit random ID and project ID
    const random8Digits = String(Math.floor(10000000 + Math.random() * 90000000));
    testProjectId = generateEntityId('pr');

    // 3. Create a temporary local text file with random ID and verification token
    const tempFileName = `artifact_audit_${random8Digits}.txt`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    const fileContent = `=== Scriptorium Project Artifact Deliverable ===\nDocument ID: ${random8Digits}\nTitle: Campaign Localisation Audit\nStatus: Approved\nVerification Token: SECURE_TOKEN_${random8Digits}\nTimestamp: ${new Date().toISOString()}\n`;
    fs.writeFileSync(tempFilePath, fileContent, 'utf8');

    // 4. Seed project record in Firestore via API
    await seedTestProject(testConfig, testProjectId);

    // 5. Navigate to Supervisor Console SPA with test project ID
    await page.goto(`/?projectId=${testProjectId}`);

    // 6. Verify left 70% Structured Inspector reflects seeded project
    const statusBadge = page.locator('[data-testid="project-status-badge"]');
    await expect(statusBadge).toBeVisible({ timeout: 15000 });
    await expect(statusBadge).toContainText('draft');

    // 7. Attach artifact file using file input
    const fileUploadBtn = page.locator('[data-testid="file-upload-btn"]');
    await expect(fileUploadBtn).toBeVisible();

    const fileInput = page.locator('[data-testid="file-upload-input"]');
    await fileInput.setInputFiles(tempFilePath);

    // 8. Verify attachment preview chip appears and indicates upload complete
    const attachedChip = page.locator('[data-testid="attached-file-chip"]');
    await expect(attachedChip).toBeVisible({ timeout: 15000 });
    await expect(attachedChip).toContainText(tempFileName);
    await expect(attachedChip).toContainText('Uploaded', { timeout: 20000 });

    // 9. Command the agent in chat to save to project artifact storage with a comment
    const commentText = `Deliverable evaluation audit token ${random8Digits}`;
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill(`Please save this attached uploaded file to project artifacts with comment "${commentText}".`);

    // 10. Click Send command
    const sendBtn = page.locator('[data-testid="chat-send-btn"]');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 11. Wait for agent to execute tool and stream response
    await expect(chatInput).toBeEnabled({ timeout: 60000 });

    // 12. Verify no execution error alert
    const errorAlert = page.locator('text=Execution Error');
    await expect(errorAlert).not.toBeVisible();

    // 13. Verify Structured Inspector artifacts list now contains the artifact and comment
    const artifactsList = page.locator('[data-testid="project-artifacts-list"]');
    await expect(artifactsList).toContainText(tempFileName, { timeout: 15000 });
    await expect(artifactsList).toContainText(random8Digits);

    // 14. Refresh the page to test persistence across reloads
    await page.reload();

    // 15. Verify that after reload, the artifacts list still contains the artifact
    await expect(artifactsList).toBeVisible({ timeout: 15000 });
    await expect(artifactsList).toContainText(tempFileName);
    await expect(artifactsList).toContainText(random8Digits);

    // 16. Ask agent to retrieve artifact document given its comment / token and return a timeboxed download URL
    await expect(chatInput).toBeVisible();
    await chatInput.fill(`Retrieve the artifact document with comment containing "${random8Digits}" and provide its secure timeboxed download URL.`);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 17. Wait for agent to retrieve download URL
    await expect(chatInput).toBeEnabled({ timeout: 60000 });
    await expect(errorAlert).not.toBeVisible();

    // 18. Verify chat window contains the download URL
    const chatWindow = page.locator('[data-testid="chat-window"]');
    await expect(chatWindow).toContainText('downloadArtifact', { timeout: 15000 });

    const chatText = await chatWindow.innerText();
    const urlMatch = chatText.match(/(https?:\/\/[^\s"'<>)\]]+downloadArtifact[^\s"'<>)\]]+)/);
    expect(urlMatch, 'Expected to extract downloadArtifact URL from agent response').not.toBeNull();
    const downloadUrl = urlMatch[1];

    // 19. Fetch the document using the secure download URL
    const response = await page.request.get(downloadUrl);
    expect(response.status()).toBe(200);

    // 20. Assert the fetched document contents match original file content
    const downloadedContent = await response.text();
    expect(downloadedContent).toContain(random8Digits);
    expect(downloadedContent).toContain(`Verification Token: SECURE_TOKEN_${random8Digits}`);
    expect(downloadedContent).toContain('Campaign Localisation Audit');

    // 21. Also verify Firestore project record contains the artifact metadata
    const db = getDb(testConfig);
    const projSnap = await db.collection('projects').doc(testProjectId).get();
    expect(projSnap.exists).toBe(true);
    const projData = projSnap.data();
    expect(Array.isArray(projData.artifacts)).toBe(true);
    const savedArtifact = projData.artifacts.find((a) => a.comment && a.comment.includes(random8Digits));
    expect(savedArtifact).toBeDefined();
    expect(savedArtifact.id).toMatch(/^ar-[a-z0-9]{6}$/);
    expect(savedArtifact.name).toBe(tempFileName);
    expect(savedArtifact.gcsUri).toContain('gs://scriptorium-project-artifacts-503507');
  });
});
