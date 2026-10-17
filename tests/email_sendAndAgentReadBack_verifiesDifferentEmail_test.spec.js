const crypto = require('crypto');
const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { getFunctionUrl, getDb, cleanupTestResources, generateEntityId } = require('./cloudHelpers.js');

test.describe('Email Endpoint & Agent Email Retrieval Integration Tests', () => {
  // Ensure all tests run sequentially
  test.describe.configure({ mode: 'serial' });

  let testProjectId = null;
  const createdEmailIds = [];

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

    // 2. Clean up test Firestore project document and its message subcollection
    if (testProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [testProjectId],
      });
      testProjectId = null;
    }
  });

  test('emailService_sendEmailAndAgentReadBack_verifiesDifferentEmailRetrieved_test', async ({ request, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    test.setTimeout(90000);

    testProjectId = generateEntityId('pr');
    const uniqueTokenB = `TOKEN-${Math.floor(100000 + Math.random() * 900000)}`;
    const uniqueNoticeA = `NOTICE-${Math.floor(100000 + Math.random() * 900000)}`;
    const testRecipient = 'delivered@resend.dev';
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not defined.');
    }
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'info@seamcode.co.uk';

    // 2. Seed project document via /seed endpoint so /chat has an active project context
    const seedUrl = getFunctionUrl(testConfig, 'seed');
    const seedRes = await request.post(seedUrl, {
      data: { projectId: testProjectId },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(seedRes.status()).toBe(200);

    const testRecipientB = `verify-${uniqueTokenB.toLowerCase()}@bronoogda.resend.app`;
    const emailSubjectB = `Scriptorium Verification Token: ${uniqueTokenB}`;
    const emailHtmlB = `<p>Your unique Scriptorium security verification code is: <strong>${uniqueTokenB}</strong>.</p>`;

    const resendResB = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [testRecipientB],
        subject: emailSubjectB,
        html: emailHtmlB,
        text: `Your unique Scriptorium security verification code is: ${uniqueTokenB}.`,
      }),
    });
    expect(resendResB.ok).toBe(true);
    const resendDataB = await resendResB.json();
    expect(resendDataB.id).toBeDefined();
    createdEmailIds.push(resendDataB.id);

    // 4. Dispatch Email A (A different test email sent via the Cloud Function endpoint)
    const emailUrl = getFunctionUrl(testConfig, 'emailService');
    const sendResA = await request.post(emailUrl, {
      data: {
        action: 'sendAcceptanceEmail',
        email: testRecipient,
        summary: {
          name: `Candidate ${uniqueNoticeA}`,
          email: testRecipient,
        },
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(sendResA.status()).toBe(200);
    const sendDataA = await sendResA.json();
    expect(sendDataA.success).toBe(true);

    if (sendDataA.result?.emailId) {
      createdEmailIds.push(sendDataA.result.emailId);
    }

    // 5. Ask the supervisor agent via /chat to locate and read back Email B (NOT Email A)
    const chatUrl = getFunctionUrl(testConfig, 'chat');
    const userPrompt = `Please check our recent email communications. Locate the email with subject containing "Scriptorium Verification Token". What is the verification token?`;

    const chatRes = await request.post(chatUrl, {
      data: {
        projectId: testProjectId,
        message: userPrompt,
      },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(chatRes.status()).toBe(200);

    const sseResponseText = await chatRes.text();
    expect(sseResponseText).toContain('event: done');

    // 6. Fetch the persisted agent message from Firestore projects/{projectId}/messages
    const db = getDb(testConfig);
    const messagesSnap = await db
      .collection('projects')
      .doc(testProjectId)
      .collection('messages')
      .where('sender', '==', 'agent')
      .get();

    expect(messagesSnap.empty).toBe(false);
    const agentMessage = messagesSnap.docs[0].data();
    expect(agentMessage.content).toBeDefined();

    // 7. Verify the agent retrieved the correct *different* email (Email B's token)
    expect(agentMessage.content).toContain(uniqueTokenB);

    // 8. Verify the agent did NOT confuse it with Email A's notice
    expect(agentMessage.content).not.toContain(uniqueNoticeA);
  });
});
