const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources } = require('./cloudHelpers.js');

test.describe('Supervisor Console Initial Load', () => {
  test.afterEach(async ({ testConfig }) => {
    await cleanupTestResources(testConfig, {
      projectIds: ['project-test-tmp']
    });
  });

  test('supervisorConsole_initialLoad_rendersSplitLayoutAndControls_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // Navigate to root Supervisor SPA
    await page.goto('/');

    // Verify header controls
    const seedBtn = page.locator('[data-testid="seed-project-btn"]');
    await expect(seedBtn).toBeVisible();

    // Verify right 30% chat panel components
    const chatWindow = page.locator('[data-testid="chat-window"]');
    await expect(chatWindow).toBeVisible();

    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();

    const sendBtn = page.locator('[data-testid="chat-send-btn"]');
    await expect(sendBtn).toBeVisible();
  });
});
