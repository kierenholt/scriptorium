const { test, expect, assertServicesRunning } = require('./loggingHelper.js');
const { getDb, cleanupTestResources, generateEntityId, seedTestProject } = require('./cloudHelpers.js');

test.describe('Email Hub Deletion Tests', () => {
  test.describe.configure({ mode: 'serial' });

  let testProjectId;
  let testEmailId;

  test.beforeEach(() => {
    testProjectId = generateEntityId('pr');
    testEmailId = generateEntityId('em');
  });

  test.afterEach(async ({ testConfig }) => {
    const db = getDb(testConfig);
    if (testEmailId) {
      try {
        await db.collection('emails').doc(testEmailId).delete();
      } catch (err) {
        console.warn(`[Cleanup Warning] Failed to delete test email ${testEmailId}:`, err.message);
      }
    }

    if (testProjectId) {
      await cleanupTestResources(testConfig, {
        projectIds: [testProjectId],
      });
      testProjectId = null;
    }
  });

  test('deleteEmail_existingEmail_deletesAndUpdatesUI_test', async ({ page, testConfig }) => {
    // 1. MANDATORY SERVICE PRE-FLIGHT ASSERTION
    await assertServicesRunning(testConfig);

    test.setTimeout(60000);

    const db = getDb(testConfig);
    const randomCode = String(Math.floor(100000 + Math.random() * 900000));
    const testSubject = `Candidate Portfolio Assessment ${randomCode}`;
    const testBody = `Completed test sample for evaluation ref ${randomCode}.`;

    // 2. Seed test project in Firestore
    await seedTestProject(testConfig, testProjectId);

    // 3. Insert test email document into Firestore 'emails' collection
    await db.collection('emails').doc(testEmailId).set({
      id: testEmailId,
      emailId: testEmailId,
      projectId: testProjectId,
      direction: 'inbound',
      from: `candidate-${randomCode}@testdomain.com`,
      to: 'info@seamcode.co.uk',
      subject: testSubject,
      body: testBody,
      sentAt: new Date().toISOString(),
    });

    // 4. Also attach email to project's emails array
    await db.collection('projects').doc(testProjectId).set(
      {
        emails: [
          {
            id: testEmailId,
            direction: 'inbound',
            from: `candidate-${randomCode}@testdomain.com`,
            to: 'info@seamcode.co.uk',
            subject: testSubject,
            body: testBody,
            timestamp: new Date().toISOString(),
          },
        ],
      },
      { merge: true }
    );

    // 5. Navigate to Supervisor Console with the test project
    await page.goto(`/?projectId=${testProjectId}`);

    // 6. Switch to Pinned "Emails" tab
    const emailsTab = page.locator('[data-testid="tab-emails"]');
    await expect(emailsTab).toBeVisible({ timeout: 10000 });
    await emailsTab.click();

    const emailHub = page.locator('[data-testid="email-hub-view"]');
    await expect(emailHub).toBeVisible({ timeout: 10000 });

    // 7. Select "Assigned" filter to view project-associated emails
    const assignedFilterBtn = page.locator('[data-testid="email-filter-assigned"]');
    await expect(assignedFilterBtn).toBeVisible();
    await assignedFilterBtn.click();

    // 8. Find and select the test email card
    const emailCard = page.locator('[data-testid="email-hub-card"]').filter({
      hasText: randomCode,
    });
    await expect(emailCard).toBeVisible({ timeout: 15000 });
    await emailCard.click();

    // 9. Verify detail pane displays the subject and ID
    const detailSubject = page.locator('[data-testid="email-detail-subject"]');
    await expect(detailSubject).toContainText(randomCode);

    // 10. Verify Delete action button is rendered in the header
    const deleteBtn = page.locator('[data-testid="emailhub-delete-btn"]');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });

    // 11. Click Delete button to trigger inline safety confirmation
    await deleteBtn.click();

    const confirmBtn = page.locator('[data-testid="emailhub-confirm-delete-btn"]');
    const cancelBtn = page.locator('[data-testid="emailhub-cancel-delete-btn"]');
    await expect(confirmBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    // 12. Test Cancel button reverts confirmation state
    await cancelBtn.click();
    await expect(confirmBtn).not.toBeVisible();
    await expect(deleteBtn).toBeVisible();

    // 13. Click Delete again and confirm deletion
    await deleteBtn.click();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 14. Verify feedback banner appears
    const feedbackBanner = page.locator('[data-testid="emailhub-feedback-banner"]');
    await expect(feedbackBanner).toBeVisible({ timeout: 10000 });
    await expect(feedbackBanner).toContainText('successfully deleted');

    // 15. Verify email card disappears from the list
    await expect(emailCard).not.toBeVisible({ timeout: 10000 });

    // 16. Verify in Firestore that the email document has been deleted
    const emailDocSnap = await db.collection('emails').doc(testEmailId).get();
    expect(emailDocSnap.exists).toBe(false);

    // 17. Verify in Firestore that the project document emails array has been updated
    const projectDocSnap = await db.collection('projects').doc(testProjectId).get();
    const updatedEmails = projectDocSnap.data()?.emails || [];
    expect(updatedEmails.some((e) => e.id === testEmailId)).toBe(false);
  });
});
