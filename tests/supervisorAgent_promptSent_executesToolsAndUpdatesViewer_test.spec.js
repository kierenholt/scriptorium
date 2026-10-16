const { test, expect } = require('./loggingHelper.js');
const { cleanupTestResources } = require('./cloudHelpers.js');

test.describe('Supervisor Agent Full E2E Flow', () => {
  test.afterEach(async ({ testConfig }) => {
    // Clean up test resources after run
    await cleanupTestResources(testConfig, {
      projectIds: ['project-default']
    });
  });

  test('supervisorAgent_promptSent_executesToolsAndUpdatesViewer_test', async ({ page, testConfig }) => {
    // Assert services running
    await assertServicesRunning(testConfig);

    // 1. Navigate to the Supervisor Console SPA

    await page.goto('/');

    // 2. Click Seed / Reset Project to initialize or reset Firestore record
    const seedBtn = page.locator('[data-testid="seed-project-btn"]');
    await expect(seedBtn).toBeVisible();
    await seedBtn.click();

    // 3. Verify the Raw JSON Document Viewer on the left (70% pane) displays seeded project
    const rawViewer = page.locator('[data-testid="project-raw-json"]');
    await expect(rawViewer).toBeVisible({ timeout: 15000 });
    await expect(rawViewer).toContainText('Scriptorium Initial Project');
    await expect(rawViewer).toContainText('"status": "draft"');

    // 4. Command the Gemini agent in the chat console
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('Change project status to completed');

    // 5. Send command
    const sendBtn = page.locator('[data-testid="chat-send-btn"]');
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 6. Verify tool execution badge appears in the chat stream
    const toolBadge = page.locator('[data-testid="tool-call-badge"]').first();
    await expect(toolBadge).toBeVisible({ timeout: 30000 });
    await expect(toolBadge).toContainText('updateStatus');

    // 7. Verify reactive real-time update in the Raw JSON Viewer (without page reload)
    await expect(rawViewer).toContainText('"status": "completed"', { timeout: 20000 });
  });
});
