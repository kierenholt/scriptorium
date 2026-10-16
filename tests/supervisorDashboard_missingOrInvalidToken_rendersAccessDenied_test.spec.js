const { test, expect, assertServicesRunning } = require('./loggingHelper.js');

test.describe('Supervisor Dashboard URL Token Guard', () => {
  test('supervisorDashboard_missingToken_rendersAccessDenied_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // Disable test auto-auth and clear session storage
    await page.addInitScript(() => {
      window.__DISABLE_TEST_SUPERVISOR_AUTH__ = true;
      try {
        sessionStorage.clear();
      } catch {
        // Ignore
      }
    });

    // Navigate to root without any token
    await page.goto('/');

    // Verify 403 Access Denied screen is displayed
    const accessDenied = page.locator('[data-testid="access-denied-screen"]');
    await expect(accessDenied).toBeVisible();

    // Verify supervisor console elements are not mounted
    const emailsTab = page.locator('[data-testid="tab-emails"]');
    await expect(emailsTab).not.toBeVisible();

    const chatWindow = page.locator('[data-testid="chat-window"]');
    await expect(chatWindow).not.toBeVisible();
  });

  test('supervisorDashboard_invalidToken_rendersAccessDenied_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // Disable test auto-auth and clear session storage
    await page.addInitScript(() => {
      window.__DISABLE_TEST_SUPERVISOR_AUTH__ = true;
      try {
        sessionStorage.clear();
      } catch {
        // Ignore
      }
    });

    // Navigate with an invalid token query parameter
    await page.goto('/?token=invalid_dummy_token_999999');

    // Verify 403 Access Denied screen is displayed
    const accessDenied = page.locator('[data-testid="access-denied-screen"]');
    await expect(accessDenied).toBeVisible();

    // Verify supervisor console elements are not mounted
    const emailsTab = page.locator('[data-testid="tab-emails"]');
    await expect(emailsTab).not.toBeVisible();
  });

  test('supervisorDashboard_validToken_authenticatesAndPersists_test', async ({ page, testConfig }) => {
    // MANDATORY PROJECT RULE: AT THE BEGINNING OF EACH TEST, THE TEST MUST ASSERT THAT THE SERVICES ARE RUNNING
    await assertServicesRunning(testConfig);

    // Disable test auto-auth so we strictly verify the query token flow
    await page.addInitScript(() => {
      window.__DISABLE_TEST_SUPERVISOR_AUTH__ = true;
      try {
        sessionStorage.clear();
      } catch {
        // Ignore
      }
    });

    // Navigate with the valid supervisor access token in query param
    await page.goto(`/?token=${testConfig.supervisorToken}`);

    // Verify console elements mount successfully
    const emailsTab = page.locator('[data-testid="tab-emails"]');
    await expect(emailsTab).toBeVisible();

    // Verify Access Denied screen is not visible
    const accessDenied = page.locator('[data-testid="access-denied-screen"]');
    await expect(accessDenied).not.toBeVisible();

    // Verify URL hygiene: ?token= has been scrubbed from address bar
    expect(page.url()).not.toContain('token=');

    // Verify token was persisted to sessionStorage
    const storedToken = await page.evaluate(() => sessionStorage.getItem('scriptorium_supervisor_token'));
    expect(storedToken).toBe(testConfig.supervisorToken);

    // Reload page without token query param to verify session persistence
    await page.reload();
    await expect(emailsTab).toBeVisible();
    await expect(accessDenied).not.toBeVisible();
  });
});
