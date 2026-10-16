const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources } = require('./cloudHelpers.js');

test.describe('Supervisor Agent Multi-Turn E2E Integration Flow', () => {
  let testProjectId;

  test.beforeEach(() => {
    testProjectId = `project-e2e-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  });

  test.afterEach(async ({ testConfig }) => {
    if (testProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [testProjectId]
      });
    }
  });

  test('supervisorAgent_multiTurnTools_mutatesFirestoreAndUpdatesViewer_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // 1. Open Supervisor Console with dedicated random project ID
    await page.goto(`/?projectId=${testProjectId}`);

    // 2. Click "Seed / Reset Project" in header to initialize record in Firestore
    const seedBtn = page.locator('[data-testid="seed-project-btn"]');
    await expect(seedBtn).toBeVisible();
    await seedBtn.click();

    // 3. Verify left 70% Raw JSON Viewer displays initial seeded project state
    const rawViewer = page.locator('[data-testid="project-raw-json"]');
    await expect(rawViewer).toBeVisible({ timeout: 15000 });
    await expect(rawViewer).toContainText(testProjectId);
    await expect(rawViewer).toContainText('"status": "draft"');

    const chatInput = page.locator('[data-testid="chat-input"]');
    const sendBtn = page.locator('[data-testid="chat-send-btn"]');

    // 4. --- TURN 1: Rename project and update status to in_progress ---
    await expect(chatInput).toBeVisible();
    await chatInput.fill("Rename project to 'Omega Initiative' and set status to in_progress");
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // Verify tool execution badges appear in the right 30% chat panel
    const renameToolBadge = page.locator('[data-testid="tool-call-badge"]').filter({ hasText: /(renameProjectDocument|renameProject)/ }).first();
    await expect(renameToolBadge).toBeVisible({ timeout: 30000 });

    const statusToolBadge = page.locator('[data-testid="tool-call-badge"]').filter({ hasText: /(updateProjectLifecycleStage|updateStatus)/ }).first();
    await expect(statusToolBadge).toBeVisible({ timeout: 30000 });

    // Verify left 70% Raw JSON Viewer reactively updates without page reload
    await expect(rawViewer).toContainText('"title": "Omega Initiative"', { timeout: 20000 });
    await expect(rawViewer).toContainText('"status": "in_progress"', { timeout: 20000 });

    // Wait for Turn 1 to complete (chat input re-enabled once streaming ends)
    await expect(chatInput).toBeEnabled({ timeout: 30000 });

    // Verify no execution error occurred in Turn 1 after completion
    const errorAlert = page.locator('text=Execution Error');
    await expect(errorAlert).not.toBeVisible();

    // 5. --- TURN 2: Set status to completed (exact user prompt) ---
    await chatInput.fill("SET STATUS TO COMPLETED");
    await expect(sendBtn).toBeEnabled({ timeout: 10000 });
    await sendBtn.click();

    // Verify Turn 2 tool execution badge appears
    const statusCompletedBadge = page.locator('[data-testid="tool-call-badge"]').filter({ hasText: /(updateProjectLifecycleStage|updateStatus)/ }).last();
    await expect(statusCompletedBadge).toBeVisible({ timeout: 30000 });

    // Verify left 70% Raw JSON Viewer reactively reflects completed status
    await expect(rawViewer).toContainText('"status": "completed"', { timeout: 20000 });

    // Wait for Turn 2 agent confirmation to conclude (chat input re-enabled)
    await expect(chatInput).toBeEnabled({ timeout: 30000 });

    // Verify no execution error occurred in Turn 2 after completion
    await expect(errorAlert).not.toBeVisible();
  });
});
