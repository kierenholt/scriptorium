const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources, generateEntityId, seedTestProject } = require('./cloudHelpers.js');

test.describe('Supervisor Agent Multi-Turn E2E Integration Flow', () => {
  let testProjectId;

  test.beforeEach(() => {
    testProjectId = generateEntityId('pr');
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

    // 1. Seed dedicated project in Firestore via API
    await seedTestProject(testConfig, testProjectId);

    // 2. Open Supervisor Console with dedicated random project ID
    await page.goto(`/?projectId=${testProjectId}`);

    // 3. Verify Structured Inspector on the left (70% pane) displays initial seeded project state
    const titleHeading = page.locator('[data-testid="project-title-heading"]');
    await expect(titleHeading).toBeVisible({ timeout: 15000 });
    const statusBadge = page.locator('[data-testid="project-status-badge"]');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('draft');

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

    // Verify Structured Inspector reactively updates without page reload
    await expect(titleHeading).toContainText('Omega Initiative', { timeout: 20000 });
    await expect(statusBadge).toContainText('in_progress', { timeout: 20000 });

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

    // Verify Structured Inspector reactively reflects completed status
    await expect(statusBadge).toContainText('completed', { timeout: 20000 });

    // Wait for Turn 2 agent confirmation to conclude (chat input re-enabled)
    await expect(chatInput).toBeEnabled({ timeout: 30000 });

    // Verify no execution error occurred in Turn 2 after completion
    await expect(errorAlert).not.toBeVisible();
  });
});
