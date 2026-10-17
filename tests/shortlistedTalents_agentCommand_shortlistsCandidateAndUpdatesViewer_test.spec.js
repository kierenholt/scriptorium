const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { cleanupTestResources } = require('./cloudHelpers.js');

test.describe('Shortlisted Talents Collection & Agent Management Flow', () => {
  let createdProjectId = null;

  test.afterEach(async ({ testConfig }) => {
    if (createdProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [createdProjectId],
      });
    }
  });

  test('shortlistedTalents_agentCommand_shortlistsCandidateAndUpdatesViewer_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // 1. Navigate to root Supervisor SPA
    await page.goto('/');

    const tabBar = page.locator('[data-testid="workspace-tab-bar"]');
    await expect(tabBar).toBeVisible({ timeout: 15000 });

    // 2. Create a new project via '+' modal
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

    // 3. Extract newly created project ID and switch to project tab
    const projectTabs = page.locator('[data-testid="workspace-tab-bar"] [data-testid^="tab-project-pr-"]');
    const newTab = projectTabs.last();
    await expect(newTab).toBeVisible({ timeout: 15000 });
    const tabTestId = await newTab.getAttribute('data-testid');
    createdProjectId = tabTestId.replace('tab-project-', '').trim();
    expect(createdProjectId).toMatch(/^pr-[a-z0-9]{6}$/);

    await newTab.click();

    // Scope to the active project session
    const session = page.locator(`[data-testid="project-session-${createdProjectId}"]`);
    await expect(session).toBeVisible();

    const idDisplay = session.locator('[data-testid="project-id-display"]');
    await expect(idDisplay).toHaveText(createdProjectId, { timeout: 15000 });

    // 4. Verify Shortlist navigation item and initial empty roster
    const shortlistNavBtn = session.locator('[data-testid="project-nav-shortlist"]');
    await expect(shortlistNavBtn).toBeVisible();
    await shortlistNavBtn.click();

    const shortlistRoster = session.locator('[data-testid="project-shortlist-list"]');
    await expect(shortlistRoster).toBeVisible();
    await expect(shortlistRoster).toContainText('No candidates currently shortlisted');

    // 5. Ask agent in chat to shortlist a candidate
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const candidateName = `Klara Weiss ${uniqueSuffix}`;
    const candidateRole = 'Senior Transcreation Specialist';

    const chatInput = session.locator('[data-testid="chat-input"]');
    const sendBtn = session.locator('[data-testid="chat-send-btn"]');

    await expect(chatInput).toBeVisible();
    await chatInput.fill(
      `Please shortlist candidate "${candidateName}" for this project as a ${candidateRole} with day rate "£520" and notes "Expert in medical localisation"`
    );
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 6. Verify agent tool badge appears in chat stream
    const shortlistToolBadge = session
      .locator('[data-testid="tool-call-badge"]')
      .filter({ hasText: /shortlistCandidateForProject/ })
      .first();
    await expect(shortlistToolBadge).toBeVisible({ timeout: 45000 });

    // 7. Verify candidate appears reactively in the Shortlisted Talent Roster
    const candidateNameEl = session.locator(`[data-testid^="project-shortlist-name-"]`).filter({ hasText: candidateName });
    await expect(candidateNameEl).toBeVisible({ timeout: 45000 });

    // Verify counter in sidebar updated
    await expect(shortlistNavBtn).toContainText('1');

    // Wait for chat to be re-enabled
    await expect(chatInput).toBeEnabled({ timeout: 45000 });

    // 8. Instruct agent to update candidate status to 'booked'
    await chatInput.fill(`Please update ${candidateName}'s status on the shortlist to booked`);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 9. Verify update tool execution badge
    const updateToolBadge = session
      .locator('[data-testid="tool-call-badge"]')
      .filter({ hasText: /updateShortlistedTalentStatus/ })
      .first();
    await expect(updateToolBadge).toBeVisible({ timeout: 45000 });

    // 10. Verify candidate status pill reactively changes to 'booked'
    const statusPill = session.locator(`[data-testid^="project-shortlist-status-"]`).filter({ hasText: 'booked' });
    await expect(statusPill).toBeVisible({ timeout: 45000 });

    // Wait for stream completion
    await expect(chatInput).toBeEnabled({ timeout: 45000 });
  });
});
