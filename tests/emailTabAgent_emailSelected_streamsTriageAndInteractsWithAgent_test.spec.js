const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { getDb, cleanupTestResources, seedTestProject } = require('./cloudHelpers.js');

test.describe('Emails Tab Agent Integration', () => {
  const testEmailId = 'em-tst888';
  const testProjectId = 'pr-7k4x9q';

  test.afterEach(async ({ testConfig }) => {
    await cleanupTestResources(testConfig, {
      projectIds: [testProjectId],
      emailIds: [testEmailId],
      cleanEmailMessages: true,
    });
  });

  test('emailTabAgent_emailSelected_streamsTriageAndInteractsWithAgent_test', async ({ page, testConfig }) => {
    // 1. Mandatory service connectivity check
    await assertServicesRunning(testConfig);

    // 2. Seed a test project
    await seedTestProject(testConfig, testProjectId);

    // 3. Seed an unassigned incoming candidate email in Firestore
    const db = getDb(testConfig);
    const now = new Date().toISOString();
    await db.collection('emails').doc(testEmailId).set({
      id: testEmailId,
      emailId: testEmailId,
      direction: 'inbound',
      from: 'candidate.hans@deutsch-transcreate.com',
      to: 'info@seamcode.co.uk',
      subject: 'Application: Senior German Transcreation Specialist - Hans Gruber',
      body: 'Hello Scriptorium team, I am applying as a senior German transcreation specialist with 8 years of experience adapting automotive brand campaigns.',
      sentAt: now,
      createdAt: now,
      projectId: null,
    });

    // 4. Navigate directly to Emails tab with project context available
    await page.goto(`/?projectId=${testProjectId}&tab=emails`);

    // 5. Assert Email Tab Session is rendered with 70/30 split view
    const emailTabSession = page.locator('[data-testid="email-tab-session"]');
    await expect(emailTabSession).toBeVisible({ timeout: 15000 });

    const emailHub = page.locator('[data-testid="email-hub-view"]');
    await expect(emailHub).toBeVisible();

    const emailChatWindow = emailTabSession.locator('[data-testid="chat-window"]');
    await expect(emailChatWindow).toBeVisible();

    // 6. Assert header in ChatPanel shows "Email Triage Agent"
    const agentTitle = emailTabSession.locator('[data-testid="chat-panel-title"]');
    await expect(agentTitle).toContainText('Email Triage Agent');

    // 7. Verify the seeded unassigned email appears in the list and select it
    const emailRow = page.locator(`[data-email-id="${testEmailId}"]`);
    await expect(emailRow).toBeVisible({ timeout: 10000 });
    await emailRow.click();

    // 8. Assert email detail body is visible
    const emailBody = page.locator('[data-testid="email-detail-body"]');
    await expect(emailBody).toContainText('German transcreation');

    // 9. Send a prompt to the Email Triage Agent inquiring about the selected email
    const chatInput = emailTabSession.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();
    await chatInput.fill('What is the sender email and subject of the currently selected email?');
    await chatInput.press('Enter');

    // 10. Wait for agent streaming response to complete
    await expect(emailTabSession.getByText('Supervisor', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(emailTabSession.getByText('Agent', { exact: true })).toBeVisible({ timeout: 30000 });

    // 11. Assert that the agent accurately references the candidate email details
    const agentMessages = emailTabSession.locator('[data-testid="chat-window"] p');
    await expect(agentMessages.last()).toContainText('Hans Gruber', { timeout: 30000 });

    // 12. Switch to Project Tab and verify background persistence
    const projectTab = page.locator(`[data-testid="tab-project-${testProjectId}"]`);
    await expect(projectTab).toBeVisible();
    await projectTab.click();

    // Verify project inspector is active and email session is hidden
    const projectInspector = page.locator('[data-testid="project-inspector-pane"]');
    await expect(projectInspector).toBeVisible();
    await expect(emailTabSession).not.toBeVisible();

    // Switch back to Emails Tab
    const emailsTab = page.locator('[data-testid="tab-emails"]');
    await emailsTab.click();

    // Assert email tab session is visible again and message history is intact
    await expect(emailTabSession).toBeVisible();
    await expect(agentMessages.last()).toContainText('Hans Gruber');
  });
});
