const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { getDb, cleanupTestResources, generateEntityId, seedTestProject } = require('./cloudHelpers.js');

test.describe('Supervisor Console Incoming Email Inbox & Assignment Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let testProjectId;
  const createdEmailIds = [];

  test.beforeEach(() => {
    testProjectId = generateEntityId('pr');
  });

  test.afterEach(async ({ testConfig }) => {
    const db = getDb(testConfig);
    for (const emailId of createdEmailIds) {
      try {
        await db.collection('emails').doc(emailId).delete();
      } catch (err) {
        console.warn(`[Cleanup Warning] Failed to delete test email ${emailId}:`, err.message);
      }
    }
    createdEmailIds.length = 0;

    if (testProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [testProjectId],
      });
      testProjectId = null;
    }
  });

  test('supervisorConsole_incomingEmailInbox_assignsEmailAndUpdatesProjectViewer_test', async ({ page, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    test.setTimeout(90000);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not defined.');
    }
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@seamcode.co.uk';
    const targetRecipient = 'info@seamcode.co.uk';
    const random8Digits = String(Math.floor(10000000 + Math.random() * 90000000));
    const testSubject = `Candidate Portfolio Assessment ${random8Digits}`;
    const testBody = `Here is my completed transcreation test sample: REF-${random8Digits}.`;

    // 2. Dispatch email strictly via the Resend API (NO direct Firestore injection)
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [targetRecipient],
        subject: testSubject,
        html: `<p>${testBody}</p>`,
        text: testBody,
      }),
    });
    expect(resendRes.ok).toBe(true);
    const resendData = await resendRes.json();
    expect(resendData.id).toBeDefined();
    createdEmailIds.push(resendData.id);

    // 3. Seed project record in Firestore via API
    await seedTestProject(testConfig, testProjectId);

    // 4. Open Supervisor Console with dedicated random project ID
    await page.goto(`/?projectId=${testProjectId}`);

    // 5. Verify left 70% Structured Inspector displays initial seeded project state
    const titleHeading = page.locator('[data-testid="project-title-heading"]');
    await expect(titleHeading).toBeVisible({ timeout: 15000 });

    // 6. Navigate to Pinned "Emails" tab to view unassigned incoming emails
    const emailsTab = page.locator('[data-testid="tab-emails"]');
    await expect(emailsTab).toBeVisible({ timeout: 10000 });
    await emailsTab.click();

    const emailHub = page.locator('[data-testid="email-hub-view"]');
    await expect(emailHub).toBeVisible({ timeout: 10000 });

    // 7. Verify the email sent via Resend API appears in the Email Hub
    const emailCard = emailHub.locator('[data-testid="email-hub-card"]').filter({
      hasText: random8Digits,
    });
    await expect(emailCard).toBeVisible({ timeout: 15000 });
    await emailCard.click();

    // 8. Click "Assign to [testProjectId]" in the assignment bar
    const assignBtn = page.locator('[data-testid="emailhub-assign-btn"]').filter({
      hasText: testProjectId,
    });
    await expect(assignBtn).toBeVisible({ timeout: 5000 });
    await assignBtn.click();

    // 9. Switch back to the project tab
    const projectTab = page.locator(`[data-testid="tab-project-${testProjectId}"]`);
    await expect(projectTab).toBeVisible({ timeout: 5000 });
    await projectTab.click();

    // 10. Verify that the Structured Inspector reflects the assigned email in project emails
    const emailsList = page.locator('[data-testid="project-emails-list"]');
    await expect(emailsList).toContainText(random8Digits, { timeout: 15000 });
    await expect(emailsList).toContainText('inbound');


    // 12. Ask the supervisor agent in the chat console to look up projects for this sender or check project emails
    const chatInput = page.locator('[data-testid="chat-input"]');
    const sendBtn = page.locator('[data-testid="chat-send-btn"]');
    await expect(chatInput).toBeVisible();

    const prompt = `Which projects are associated with sender "${fromEmail}"?`;
    await chatInput.fill(prompt);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 13. Verify tool execution badge appears in the chat panel
    const toolBadge = page.locator('[data-testid="tool-call-badge"]').filter({
      hasText: /(getProjectsFromEmailSender|getProjectsFromSender|lookupProjectsByEmailSender)/,
    }).first();
    await expect(toolBadge).toBeVisible({ timeout: 35000 });

    // 14. Verify agent answers with the project ID
    await expect(chatInput).toBeEnabled({ timeout: 45000 });
    const chatWindow = page.locator('[data-testid="chat-window"]');
    await expect(chatWindow).toContainText(testProjectId);
  });
});
