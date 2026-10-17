const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { getDb, cleanupTestResources, generateEntityId, seedTestProject } = require('./cloudHelpers.js');

test.describe('Supervisor Agent Email Send & Receive E2E Tests', () => {
  // Ensure all tests run sequentially
  test.describe.configure({ mode: 'serial' });

  let testProjectId;
  const createdEmailIds = [];

  test.beforeEach(() => {
    testProjectId = generateEntityId('pr');
  });

  test.afterEach(async ({ testConfig }) => {
    // 1. Clean up test email documents from Firestore 'emails' collection
    const db = getDb(testConfig);
    for (const emailId of createdEmailIds) {
      try {
        await db.collection('emails').doc(emailId).delete();
      } catch (err) {
        console.warn(`[Cleanup Warning] Failed to delete test email ${emailId}:`, err.message);
      }
    }
    // Also clean up any cached email documents matching created IDs
    try {
      const snap = await db.collection('emails').get();
      for (const doc of snap.docs) {
        const d = doc.data();
        if (d.resendId && createdEmailIds.includes(d.resendId)) {
          await doc.ref.delete();
        }
      }
    } catch (e) {}
    createdEmailIds.length = 0;

    // 2. Clean up test Firestore project document and messages
    if (testProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [testProjectId]
      });
      testProjectId = null;
    }
  });

  test('supervisorAgent_sendEmailPrompt_dispatchesEmailAndVerifiesOnResend_test', async ({ page, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    test.setTimeout(90000);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not defined.');
    }
    const random8DigitsSend = String(Math.floor(10000000 + Math.random() * 90000000));
    const testRecipient = 'delivered@resend.dev';
    const emailSubject = `Confirmation Code ${random8DigitsSend}`;

    // 2. Seed project record in Firestore via API
    await seedTestProject(testConfig, testProjectId);

    // 3. Open Supervisor Console with dedicated random project ID
    await page.goto(`/?projectId=${testProjectId}`);

    // 4. Verify left 70% Structured Inspector displays initial seeded project state
    const titleHeading = page.locator('[data-testid="project-title-heading"]');
    await expect(titleHeading).toBeVisible({ timeout: 15000 });

    // 5. Command the agent in the chat input to send an email with the exact 8-digit ID
    const chatInput = page.locator('[data-testid="chat-input"]');
    const sendBtn = page.locator('[data-testid="chat-send-btn"]');
    await expect(chatInput).toBeVisible();

    const sendPrompt = `Please send an email to ${testRecipient} with subject "${emailSubject}" and the exact text ${random8DigitsSend}`;
    await chatInput.fill(sendPrompt);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 6. Verify tool execution badge appears in the chat panel
    const sendToolBadge = page.locator('[data-testid="tool-call-badge"]').filter({
      hasText: /(sendCandidateEmailMessage|sendEmail|dispatchEmail)/
    }).first();
    await expect(sendToolBadge).toBeVisible({ timeout: 35000 });

    // 7. Wait for the agent to finish streaming and re-enable chat input
    await expect(chatInput).toBeEnabled({ timeout: 45000 });

    // 8. Verify no execution error alert occurred
    const errorAlert = page.locator('text=Execution Error');
    await expect(errorAlert).not.toBeVisible();

    // 9. Assert against the Resend API that the email was dispatched with the 8-digit ID
    let foundEmail = null;
    const deadline = Date.now() + 30000;

    while (Date.now() < deadline) {
      try {
        const listRes = await fetch('https://api.resend.com/emails', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (listRes.ok) {
          const listData = await listRes.json();
          const matchedSummary = (listData.data || []).find((e) =>
            e.subject && e.subject.includes(random8DigitsSend)
          );
          if (matchedSummary) {
            const detailRes = await fetch(`https://api.resend.com/emails/${matchedSummary.id}`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            if (detailRes.ok) {
              foundEmail = await detailRes.json();
              createdEmailIds.push(matchedSummary.id);
              break;
            }
          }
        }
      } catch (err) {
        // Retry
      }
      await page.waitForTimeout(2000);
    }

    expect(foundEmail).not.toBeNull();
    const emailBody = foundEmail.text || foundEmail.html || '';
    expect(emailBody).toContain(random8DigitsSend);
  });

  test('supervisorAgent_readReceivedEmailPrompt_extracts8DigitIdFromEmail_test', async ({ page, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    test.setTimeout(90000);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not defined.');
    }
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@seamcode.co.uk';
    const random8DigitsReceive = String(Math.floor(10000000 + Math.random() * 90000000));
    const targetRecipient = `candidate-${random8DigitsReceive}@bronoogda.resend.app`;
    const receiveSubject = `Candidate Dossier Reference ${random8DigitsReceive}`;
    const receiveHtml = `<p>The candidate evaluation reference number is <strong>${random8DigitsReceive}</strong>.</p>`;

    // 2. Dispatch a genuine inbound email using Resend API to @bronoogda.resend.app (NO direct Firestore injection)
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [targetRecipient],
        subject: receiveSubject,
        html: receiveHtml,
        text: `The candidate evaluation reference number is ${random8DigitsReceive}.`,
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

    const titleHeading = page.locator('[data-testid="project-title-heading"]');
    await expect(titleHeading).toBeVisible({ timeout: 15000 });

    // 5. Ask the agent in the chat UI to read the received inbound email and extract the 8-digit ID
    const chatInput = page.locator('[data-testid="chat-input"]');
    const sendBtn = page.locator('[data-testid="chat-send-btn"]');
    await expect(chatInput).toBeVisible();

    const receivePrompt = `Please check our received emails with subject containing "Candidate Dossier Reference". What is the 8-digit reference ID?`;
    await chatInput.fill(receivePrompt);
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();

    // 6. Verify tool execution badge appears in chat panel
    const readToolBadge = page.locator('[data-testid="tool-call-badge"]').filter({
      hasText: /(readCandidateEmailMessage|readEmail|checkReceivedEmail)/
    }).first();
    await expect(readToolBadge).toBeVisible({ timeout: 35000 });

    // 7. Wait for agent to finish streaming and re-enable chat input
    await expect(chatInput).toBeEnabled({ timeout: 45000 });

    // 8. Verify no execution error alert occurred
    const errorAlert = page.locator('text=Execution Error');
    await expect(errorAlert).not.toBeVisible();

    // 9. Assert that the agent response in the chat window reproduces the 8-digit ID
    const chatWindow = page.locator('[data-testid="chat-window"]');
    await expect(chatWindow).toContainText(random8DigitsReceive);

    // 10. Also verify the persisted agent response in Firestore contains the exact 8-digit ID
    const db = getDb(testConfig);
    const messagesSnap = await db
      .collection('projects')
      .doc(testProjectId)
      .collection('messages')
      .where('sender', '==', 'agent')
      .get();

    expect(messagesSnap.empty).toBe(false);
    const agentMessages = messagesSnap.docs.map((d) => d.data().content || '');
    const foundInFirestore = agentMessages.some((msg) => msg.includes(random8DigitsReceive));
    expect(foundInFirestore).toBe(true);
  });
});
