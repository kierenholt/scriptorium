const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources } = require('./cloudHelpers.js');

test.describe('Supervisor Console Create Project and Tagging Flow', () => {
  let createdProjectId = null;

  test.afterEach(async ({ testConfig }) => {
    if (createdProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [createdProjectId],
      });
    }
  });

  test('supervisorConsole_createNewProjectAndAddTag_tagAppearsInInspector_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // 1. Navigate to root Supervisor SPA
    await page.goto('/');

    const tabBar = page.locator('[data-testid="workspace-tab-bar"]');
    await expect(tabBar).toBeVisible({ timeout: 15000 });

    // 2. Completely in UI: Create a new project via '+' modal
    const plusBtn = page.locator('[data-testid="tab-new-project-btn"]');
    await expect(plusBtn).toBeVisible();
    await plusBtn.click();

    const modal = page.locator('[data-testid="open-project-modal"]');
    await expect(modal).toBeVisible();

    const createBtn = page.locator('[data-testid="modal-create-project-btn"]');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    // Verify modal closes
    await expect(modal).not.toBeVisible({ timeout: 15000 });

    // 3. Extract newly created project ID and navigate to the project tab
    const projectTabs = page.locator('[data-testid="workspace-tab-bar"] [data-testid^="tab-project-pr-"]');
    const newTab = projectTabs.last();
    await expect(newTab).toBeVisible({ timeout: 15000 });
    const tabTestId = await newTab.getAttribute('data-testid');
    createdProjectId = tabTestId.replace('tab-project-', '').trim();
    expect(createdProjectId).toMatch(/^pr-[a-z0-9]{6}$/);

    // Navigate to the newly created project tab
    await newTab.click();

    // Scope to the active project session
    const session = page.locator(`[data-testid="project-session-${createdProjectId}"]`);
    await expect(session).toBeVisible();

    const idDisplay = session.locator('[data-testid="project-id-display"]');
    await expect(idDisplay).toHaveText(createdProjectId, { timeout: 15000 });

    // 4. Navigate to Tags section in the project inspector sub-sidebar
    const tagsNavBtn = session.locator('[data-testid="project-nav-tags"]');
    await expect(tagsNavBtn).toBeVisible();
    await tagsNavBtn.click();

    const tagsList = session.locator('[data-testid="project-tags-list"]');
    await expect(tagsList).toBeVisible();

    // 5. Ask the agent in the chat console to add a new tag <random number>
    const randomNum = Math.floor(100000 + Math.random() * 900000).toString();
    const chatInput = session.locator('[data-testid="chat-input"]');
    const sendBtn = session.locator('[data-testid="chat-send-btn"]');

    await expect(chatInput).toBeVisible();
    await chatInput.fill(`Please add the requirement tag "${randomNum}" to this project`);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 6. Verify tool execution badge appears in chat stream
    const toolBadge = session
      .locator('[data-testid="tool-call-badge"]')
      .filter({ hasText: /addProjectRequirementTag/ })
      .first();
    await expect(toolBadge).toBeVisible({ timeout: 45000 });

    // 7. Wait a bit and assert the tag shows up in the tags list
    const createdTag = session.locator(`[data-testid="project-tag-${randomNum}"]`);
    await expect(createdTag).toBeVisible({ timeout: 45000 });
    await expect(createdTag).toContainText(randomNum);
    await expect(tagsList).toContainText(randomNum);

    // Wait for agent response stream to finish (chat input re-enabled)
    await expect(chatInput).toBeEnabled({ timeout: 45000 });
  });
});
