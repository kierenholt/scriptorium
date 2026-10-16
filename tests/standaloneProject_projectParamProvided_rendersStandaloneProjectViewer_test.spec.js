const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources, seedTestProject } = require('./cloudHelpers.js');

test.describe('Standalone Project Page (?project=<id>)', () => {
  test.afterEach(async ({ testConfig }) => {
    await cleanupTestResources(testConfig, {
      projectIds: ['pr-7k4x9q'],
    });
  });

  test('standaloneProject_projectParamProvided_rendersStandaloneProjectViewer_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // 1. Seed project document to guarantee Firestore record exists
    await seedTestProject(testConfig, 'pr-7k4x9q');

    // 2. Navigate to standalone page using ?project=pr-7k4x9q
    await page.goto('/?project=pr-7k4x9q');

    // 3. Verify standalone container is rendered
    const standaloneContainer = page.locator('[data-testid="standalone-project-view-pr-7k4x9q"]');
    await expect(standaloneContainer).toBeVisible({ timeout: 15000 });

    // 4. Verify Project Domain sub-sidebar navigation buttons are all visible
    const navOverview = page.locator('[data-testid="project-nav-overview"]');
    await expect(navOverview).toBeVisible();

    const navBrief = page.locator('[data-testid="project-nav-brief"]');
    await expect(navBrief).toBeVisible();

    const navTags = page.locator('[data-testid="project-nav-tags"]');
    await expect(navTags).toBeVisible();

    const navArtifacts = page.locator('[data-testid="project-nav-artifacts"]');
    await expect(navArtifacts).toBeVisible();

    const navEmails = page.locator('[data-testid="project-nav-emails"]');
    await expect(navEmails).toBeVisible();

    // 5. Verify the supervisor chrome (TabBar and ChatPanel) are NOT rendered
    const chatWindow = page.locator('[data-testid="chat-window"]');
    await expect(chatWindow).not.toBeVisible();

    const tabBar = page.locator('[data-testid="workspace-tab-bar"]');
    await expect(tabBar).not.toBeVisible();

    const emailsTab = page.locator('[data-testid="tab-emails"]');
    await expect(emailsTab).not.toBeVisible();

    // 6. Test sub-sidebar navigation: click "Requirements & Tags"
    await navTags.click();
    const tagsCard = page.locator('[data-testid="project-tags-card"]');
    await expect(tagsCard).toBeVisible();

    // 7. Test Raw JSON toggle
    const rawToggle = page.locator('[data-testid="project-view-mode-raw"]');
    await expect(rawToggle).toBeVisible();
    await rawToggle.click();

    const rawJson = page.locator('[data-testid="project-raw-json"]');
    await expect(rawJson).toBeVisible();

    // 8. Test invalid project parameter handling
    await page.goto('/?project=invalid-param');
    const invalidState = page.locator('[data-testid="standalone-project-invalid"]');
    await expect(invalidState).toBeVisible({ timeout: 10000 });

    const returnBtn = page.locator('[data-testid="standalone-return-supervisor-btn"]');
    await expect(returnBtn).toBeVisible();

    // 9. Navigate to supervisor dashboard and verify Project Only link is present in ProjectViewer header
    await page.goto('/?projectId=pr-7k4x9q');
    const projectOnlyLink = page.locator('[data-testid="project-only-link"]');
    await expect(projectOnlyLink).toBeVisible({ timeout: 15000 });
    await expect(projectOnlyLink).toHaveAttribute('href', '/?project=pr-7k4x9q');
  });
});
