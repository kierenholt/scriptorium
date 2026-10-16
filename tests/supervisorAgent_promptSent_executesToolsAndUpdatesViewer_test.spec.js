const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources, seedTestProject } = require('./cloudHelpers.js');

test.describe('Supervisor Agent Full E2E Flow', () => {
  test.afterEach(async ({ testConfig }) => {
    // Clean up test resources after run
    await cleanupTestResources(testConfig, {
      projectIds: ['pr-7k4x9q']
    });
  });

  test('supervisorAgent_promptSent_executesToolsAndUpdatesViewer_test', async ({ page, testConfig }) => {
    // Assert services running
    await assertServicesRunning(testConfig);

    // 1. Seed project document via API endpoint
    await seedTestProject(testConfig, 'pr-7k4x9q');

    // 2. Navigate to the Supervisor Console SPA
    await page.goto('/');

    // 3. Verify Structured Inspector on the left (70% pane) displays seeded project
    const titleHeading = page.locator('[data-testid="project-title-heading"]');
    await expect(titleHeading).toBeVisible({ timeout: 15000 });
    await expect(titleHeading).toContainText('Scriptorium Initial Project');

    const statusBadge = page.locator('[data-testid="project-status-badge"]');
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('draft');

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
    await expect(toolBadge).toContainText(/updateProjectLifecycleStage|updateStatus/);

    // 7. Verify reactive real-time update in the Structured Inspector (without page reload)
    await expect(statusBadge).toContainText('completed', { timeout: 20000 });
  });
});
