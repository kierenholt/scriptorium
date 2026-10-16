const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources, seedTestProject } = require('./cloudHelpers.js');

test.describe('Supervisor Console Workspace Tabs & Email Hub', () => {
  test.afterEach(async ({ testConfig }) => {
    await cleanupTestResources(testConfig, {
      projectIds: ['pr-7k4x9q', 'pr-a1b2c3'],
    });
  });

  test('supervisorConsole_projectTabs_opensSwitchesAndViewsEmails_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // 1. Seed default project to ensure an existing project record is in Firestore
    await seedTestProject(testConfig, 'pr-7k4x9q');

    // 2. Navigate to root Supervisor SPA
    await page.goto('/');

    // 2. Verify TabBar rendered with pinned Emails tab and default project tab
    const tabBar = page.locator('[data-testid="workspace-tab-bar"]');
    await expect(tabBar).toBeVisible();

    const emailsTab = page.locator('[data-testid="tab-emails"]');
    await expect(emailsTab).toBeVisible();

    const defaultProjectTab = page.locator('[data-testid="tab-project-pr-7k4x9q"]');
    await expect(defaultProjectTab).toBeVisible();

    // 3. Verify Project Tab View rendered (Structured Inspector 70% + Chat window 30%)
    const inspectorPane = page.locator('[data-testid="project-inspector-pane"]');
    await expect(inspectorPane).toBeVisible({ timeout: 15000 });

    const chatWindow = page.locator('[data-testid="chat-window"]');
    await expect(chatWindow).toBeVisible();

    // 4. Click '+' button to open the Open / Create Project modal
    const plusBtn = page.locator('[data-testid="tab-new-project-btn"]');
    await expect(plusBtn).toBeVisible();
    await plusBtn.click();

    const modal = page.locator('[data-testid="open-project-modal"]');
    await expect(modal).toBeVisible();

    // 5. Open custom project ID "pr-a1b2c3"
    const idInput = page.locator('[data-testid="modal-project-id-input"]');
    await idInput.fill('pr-a1b2c3');

    const openBtn = page.locator('[data-testid="modal-open-project-btn"]');
    await openBtn.click();

    // 6. Verify modal closes and new project tab is created and active
    await expect(modal).not.toBeVisible();

    const newTab = page.locator('[data-testid="tab-project-pr-a1b2c3"]');
    await expect(newTab).toBeVisible();

    // 7. Click "Emails" tab to switch to full-screen Email Hub
    await emailsTab.click();

    const emailHub = page.locator('[data-testid="email-hub-view"]');
    await expect(emailHub).toBeVisible();

    const allFilterBtn = page.locator('[data-testid="email-filter-all"]');
    await expect(allFilterBtn).toBeVisible();

    const unassignedFilterBtn = page.locator('[data-testid="email-filter-unassigned"]');
    await expect(unassignedFilterBtn).toBeVisible();

    // 8. Switch back to project tab "pr-a1b2c3"
    await newTab.click();
    await expect(emailHub).not.toBeVisible();

    // 9. Close tab "pr-a1b2c3"
    const closeBtn = page.locator('[data-testid="tab-close-btn-pr-a1b2c3"]');
    await closeBtn.click();

    await expect(newTab).not.toBeVisible();
    await expect(defaultProjectTab).toBeVisible();
  });
});
