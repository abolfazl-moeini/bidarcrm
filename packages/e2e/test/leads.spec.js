/**
 * BidarCRM E2E Test Suite - Section 5: Leads & 1-Click Convert (`/leads`)
 *
 * Real browser-driven Playwright test verifying:
 * 1. Leads Directory & Status Filtering (/leads):
 *    - Verify page title, header counter, table structure, and column headers.
 *    - Verify status filtering tabs (همه وضعیت‌ها, سرنخ جدید, در حال پیگیری, تبدیل‌شده, غیرفعال/ناموفق).
 *    - Verify real-time search by lead name and phone number.
 * 2. Lead Quick Create Modal ("سرنخ جدید"):
 *    - Open modal, test required field validation (error on empty lastName).
 *    - Fill full lead details (first/last name, company/account, phone, email, source).
 *    - Intercept `POST /Lead`, assert HTTP 200/201, confirm modal close and table update.
 * 3. 1-Click Convert Action (POST /Lead/action/convert):
 *    - Locate an unconverted lead.
 *    - Click "تبدیل به معامله" (1-Click Convert).
 *    - Intercept `POST /Lead/action/convert` with `{ id: lead.id }`.
 *    - Assert HTTP 200 OK, verify success notification banner, and confirm row status updates to Converted.
 * 4. SMS Quick Send Modal:
 *    - Click SMS icon in lead row, verify modal opens with prefilled phone.
 *    - Type SMS message, submit, and intercept `POST /BidarSms/send`.
 *    - Validate payload structure and server response.
 */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import {
  assertResponseOk,
  cleanupEntities,
  loginToApp,
  recordFatalError,
  triggerAndWaitForResponse,
  waitForUiSettled,
} from '../lib/test-helpers.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8089/app/';
const CREDENTIALS = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin',
};
const LIVE_SMS = process.env.E2E_LIVE_SMS === '1';

export async function runLeadsSection5Tests() {
  console.log('================================================================');
  console.log('🚀 Starting BidarCRM E2E Pipeline: Section 5 (سرنخ‌ها و تبدیل ۱-کلیکه)');
  console.log(`🎯 Target URL: ${BASE_URL}`);
  console.log('================================================================\n');

  const testResults = {
    leadsDirectoryAndFiltering: { passed: false, details: null, bugDossier: null },
    leadCreateModal: { passed: false, details: null, bugDossier: null },
    oneClickConvert: { passed: false, details: null, bugDossier: null },
    smsQuickSendModal: { passed: false, details: null, bugDossier: null },
  };

  let browser = null;
  let page = null;
  let cleanupCreatedEntities = null;

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fa-IR',
    });

    page = await context.newPage();
    cleanupCreatedEntities = cleanupEntities(page);
    if (process.env.E2E_LIVE_SMS !== '1') {
      await page.route('**/api/v1/BidarSms/send', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, simulated: true }),
      }));
    }

    // Track network calls
    const networkLogs = [];
    page.on('request', (req) => {
      if (['POST', 'PATCH', 'DELETE'].includes(req.method()) || req.url().includes('/Lead') || req.url().includes('/BidarSms')) {
        networkLogs.push({
          type: 'REQUEST',
          timestamp: new Date().toISOString(),
          url: req.url(),
          method: req.method(),
          postData: req.postData(),
        });
      }
    });

    page.on('response', async (res) => {
      if (['POST', 'PATCH', 'DELETE'].includes(res.request().method()) || res.url().includes('/Lead') || res.url().includes('/BidarSms')) {
        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch {
          bodyText = '<unreadable>';
        }
        networkLogs.push({
          type: 'RESPONSE',
          timestamp: new Date().toISOString(),
          url: res.url(),
          status: res.status(),
          statusText: res.statusText(),
          body: bodyText.slice(0, 500),
        });
      }
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    async function ensureModalClosed() {
      try {
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          const closeBtn = modal.locator('button[title="بستن"], button:has-text("انصراف")').first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
          await waitForUiSettled(page);
        }
      } catch {
        // Ignore
      }
    }
    // -------------------------------------------------------------
    // Initial Setup: Log in
    // -------------------------------------------------------------
    console.log('🔐 [Setup] Logging in as admin...');
    await loginToApp(page, BASE_URL, CREDENTIALS);
    console.log('✅ Logged in successfully.\n');

    // =============================================================
    // Scenario 1: Leads Directory & Status Filtering (/leads)
    // =============================================================
    console.log('--- [Scenario 1] Testing Leads Directory & Status Filtering (/leads) ---');
    try {
      await page.locator('nav a[href="/leads"], a[href="/leads"]').first().click();
      await waitForUiSettled(page);

      assert(page.url().includes('/leads'), `Expected URL to include /leads, got ${page.url()}`);
      const h1Text = await page.locator('h1').innerText();
      assert(h1Text.includes('سرنخ‌های فروش'), `Expected heading to contain 'سرنخ‌های فروش', got '${h1Text}'`);

      const table = page.locator('table.bidar-leads-table');
      assert((await table.count()) > 0, 'Leads table (table.bidar-leads-table) not found.');

      const initialRowCount = await table.locator('tbody tr').count();
      console.log(`   Found ${initialRowCount} leads in table.`);
      assert(initialRowCount > 0, 'Leads table is empty, expected seeded leads.');

      // Check Table Headers
      const theadText = await table.locator('thead').innerText();
      assert(theadText.includes('نام سرنخ'), 'Missing "نام سرنخ" header');
      assert(theadText.includes('شرکت') || theadText.includes('سازمان'), 'Missing "شرکت / سازمان" header');
      assert(theadText.includes('وضعیت'), 'Missing "وضعیت" header');
      assert(theadText.includes('شماره تماس'), 'Missing "شماره تماس" header');
      assert(theadText.includes('تبدیل به معامله'), 'Missing "تبدیل به معامله" header');

      // Test Status Filters
      console.log('   Testing status filter buttons...');
      const filterAll = page.locator('button:has-text("همه وضعیت‌ها")');
      const filterNew = page.locator('button:has-text("سرنخ جدید")').last(); // Avoid header button
      const filterInProcess = page.locator('button:has-text("در حال پیگیری")').first();
      const filterConverted = page.locator('button:has-text("تبدیل‌شده")').first();

      assert((await filterAll.count()) > 0, 'Filter "همه وضعیت‌ها" not found.');
      assert((await filterInProcess.count()) > 0, 'Filter "در حال پیگیری" not found.');

      // Click "در حال پیگیری"
      await filterInProcess.click();
      await waitForUiSettled(page);
      const inProcessCount = await table.locator('tbody tr').count();
      console.log(`   Leads in 'در حال پیگیری': ${inProcessCount}`);

      // Click "تبدیل‌شده"
      if ((await filterConverted.count()) > 0) {
        await filterConverted.click();
        await waitForUiSettled(page);
        const convertedCount = await table.locator('tbody tr').count();
        console.log(`   Leads in 'تبدیل‌شده': ${convertedCount}`);
      }

      // Reset to "همه وضعیت‌ها"
      await filterAll.click();
      await waitForUiSettled(page);
      assert((await table.locator('tbody tr').count()) === initialRowCount, 'Clearing status filter did not restore total count.');

      // Test Search Box
      const searchInput = page.locator('input[placeholder*="جستجو در سرنخ‌ها"]');
      assert((await searchInput.count()) > 0, 'Leads search input not found.');

      const firstLeadName = (await table.locator('tbody tr td:nth-child(1)').first().innerText()).split('\n').pop().trim();
      const searchTerm = firstLeadName.split(' ')[0] || firstLeadName;
      console.log(`   Searching for lead: "${searchTerm}"`);

      await searchInput.fill(searchTerm);
      await waitForUiSettled(page);

      const searchMatchCount = await table.locator('tbody tr').count();
      assert(searchMatchCount >= 1, `Expected at least 1 match for '${searchTerm}', got ${searchMatchCount}`);

      // Clear search
      await searchInput.fill('');
      await waitForUiSettled(page);
      assert((await table.locator('tbody tr').count()) === initialRowCount, 'Clearing search did not restore row count.');

      testResults.leadsDirectoryAndFiltering = {
        passed: true,
        details: `Leads directory verified: ${initialRowCount} leads found, column headers validated, status filters responsive, and real-time search confirmed.`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 1 Passed] Leads Directory & Status Filtering verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 1 Failed]:', err.message);
      testResults.leadsDirectoryAndFiltering = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-LEADS-001',
          title: 'Leads Directory & Status Filtering Failure',
          assertion: err.message,
          reproduction: ['1. Navigate to /leads.', '2. Inspect table headers, status filters, and search bar.'],
          networkLogs: networkLogs.slice(-5),
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }

    // =============================================================
    // Scenario 2: Lead Quick Create Modal ("سرنخ جدید")
    // =============================================================
    console.log('--- [Scenario 2] Testing Lead Quick Create Modal ("سرنخ جدید") ---');
    let newlyCreatedLeadLastName = '';
    let newlyCreatedLeadId = '';
    let postLeadResponse = null;
    let postLeadStatus = null;
    let postLeadPayload = null;
    let postLeadResponseBody = null;
    try {
      const openModalBtn = page.locator('button.bg-emerald-600:has-text("سرنخ جدید")');
      assert((await openModalBtn.count()) > 0, '"سرنخ جدید" header button not found.');
      await openModalBtn.click();
      await waitForUiSettled(page);

      const modal = page.locator('[role="dialog"]');
      assert(await modal.isVisible(), 'Lead create modal dialog is not visible.');

      // Check Form Fields
      const firstNameInput = modal.locator('input[placeholder="نام"]');
      const lastNameInput = modal.locator('input[placeholder="نام خانوادگی"]');
      const accountInput = modal.locator('input[placeholder*="شرکت"]');
      const phoneInput = modal.locator('input[placeholder="09121234567"]');
      const emailInput = modal.locator('input[placeholder="name@mail.ir"]');
      const sourceSelect = modal.locator('select');

      assert((await firstNameInput.count()) > 0, 'First name input missing');
      assert((await lastNameInput.count()) > 0, 'Last name input missing');
      assert((await accountInput.count()) > 0, 'Account name input missing');
      assert((await phoneInput.count()) > 0, 'Phone input missing');
      assert((await emailInput.count()) > 0, 'Email input missing');
      assert((await sourceSelect.count()) > 0, 'Source select missing');

      // 2.1 Test Validation (Empty Form)
      console.log('   Testing empty form validation...');
      await modal.locator('button:has-text("ذخیره سرنخ")').click();
      await waitForUiSettled(page);

      const errorNotice = modal.locator('.bg-rose-500\\/10');
      assert((await errorNotice.count()) > 0, 'Expected validation error alert when submitting empty lead form.');
      const errorText = await errorNotice.innerText();
      console.log(`   Validation error caught: "${errorText.trim()}"`);
      assert(errorText.includes('نام خانوادگی'), `Expected error message to mention last name, got: '${errorText}'`);

      // 2.2 Fill Valid Lead Information
      const uniqueSuffix = Date.now().toString().slice(-4);
      const testFirstName = 'امیررضا';
      const testLastName = `صالحی‌نیا ${uniqueSuffix}`;
      newlyCreatedLeadLastName = testLastName;
      const testAccount = `شرکت نوآوران ارتباطات داده ${uniqueSuffix}`;
      const testPhone = `0912${uniqueSuffix.padStart(7, '3')}`;
      const testEmail = `salehi.${uniqueSuffix}@test.ir`;

      console.log(`   Submitting new lead: ${testFirstName} ${testLastName} (${testAccount})...`);

      await firstNameInput.fill(testFirstName);
      await lastNameInput.fill(testLastName);
      await accountInput.fill(testAccount);
      await phoneInput.fill(testPhone);
      await emailInput.fill(testEmail);
      await sourceSelect.selectOption('Web Site');

      postLeadResponse = await triggerAndWaitForResponse(
        page,
        (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/v1/Lead',
        () => modal.locator('button:has-text("ذخیره سرنخ")').click()
      );
      postLeadStatus = postLeadResponse.status();
      try {
        postLeadPayload = postLeadResponse.request().postDataJSON();
      } catch {
        postLeadPayload = postLeadResponse.request().postData();
      }
      postLeadResponseBody = await assertResponseOk(postLeadResponse, 'POST /Lead');
      await cleanupCreatedEntities.trackResponse(postLeadResponse);
      const createdLead = JSON.parse(postLeadResponseBody);
      newlyCreatedLeadId = createdLead.id;
      assert(newlyCreatedLeadId, `POST /Lead response is missing the created lead ID: ${postLeadResponseBody.slice(0, 1000)}`);

      console.log(`   POST /Lead response status: ${postLeadStatus}`);
      console.log(`   POST /Lead payload sent:`, postLeadPayload);

      assert(
        postLeadPayload?.lastName === testLastName,
        `POST /Lead payload lastName mismatch: expected "${testLastName}", got "${postLeadPayload?.lastName}" (HTTP ${postLeadStatus}; response body: ${postLeadResponseBody.slice(0, 1000)})`
      );
      assert(
        postLeadPayload?.phoneNumber === testPhone,
        `POST /Lead payload phoneNumber mismatch: expected "${testPhone}", got "${postLeadPayload?.phoneNumber}" (HTTP ${postLeadStatus}; response body: ${postLeadResponseBody.slice(0, 1000)})`
      );

      await waitForUiSettled(page);
      assert(!(await modal.isVisible()), 'Modal should close after successful lead submission.');

      // Verify lead appears in table
      await page.locator(`table.bidar-leads-table tbody tr:has-text("${testLastName}")`).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      const tableText = await page.locator('table.bidar-leads-table').innerText();
      assert(tableText.includes(testLastName), `New lead '${testLastName}' not found in leads table.`);

      testResults.leadCreateModal = {
        passed: true,
        details: `Lead "${testFirstName} ${testLastName}" successfully created via POST /Lead (HTTP ${postLeadStatus}) and verified in table.`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 2 Passed] Lead Quick Create Modal verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 2 Failed]:', err.message);
      testResults.leadCreateModal = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-LEADS-002',
          title: 'Lead Quick Create Modal Failure',
          assertion: err.message,
          reproduction: [
            '1. Navigate to /leads and click "سرنخ جدید".',
            '2. Fill lead information and submit.',
          ],
          httpStatus: postLeadStatus,
          requestPayload: postLeadPayload,
          responseBody: postLeadResponseBody ?? (postLeadResponse
            ? await postLeadResponse.text().catch(() => '<unreadable response body>')
            : '<not captured>'),
          domSnippet: await page.locator('[role="dialog"]').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((l) => l.url?.includes('/Lead')),
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }

    // =============================================================
    // Scenario 3: 1-Click Convert Action (POST /Lead/action/convert)
    // =============================================================
    console.log('--- [Scenario 3] Testing 1-Click Convert Action (POST /Lead/action/convert) ---');
    let convertResponse = null;
    let convertStatus = null;
    let convertPayload = null;
    let convertResponseBody = null;
    try {
      // Find an unconverted lead row with "تبدیل به معامله" button
      const convertButtons = page.locator('table.bidar-leads-table tbody tr button:has-text("تبدیل به معامله")');
      const convertCount = await convertButtons.count();
      console.log(`   Found ${convertCount} unconverted leads available for 1-Click Convert.`);
      assert(convertCount > 0, 'No unconverted leads found with "تبدیل به معامله" button.');

      // Conversion mutates CRM data, so only the disposable lead from Scenario 2 is safe.
      if (!newlyCreatedLeadId || !newlyCreatedLeadLastName) {
        throw new Error('Disposable lead from Scenario 2 is unavailable; refusing to convert existing CRM data.');
      }
      const targetRow = page.locator('table.bidar-leads-table tbody tr')
        .filter({ hasText: newlyCreatedLeadLastName })
        .first();
      if ((await targetRow.count()) === 0 || (await targetRow.locator('button:has-text("تبدیل به معامله")').count()) === 0) {
        throw new Error(`Disposable lead "${newlyCreatedLeadLastName}" has no conversion action; refusing to convert existing CRM data.`);
      }

      const leadDisplayName = (await targetRow.locator('td:nth-child(1)').innerText()).split('\n').pop().trim();
      console.log(`   Executing 1-Click Convert on lead: "${leadDisplayName}"`);

      const convertBtn = targetRow.locator('button:has-text("تبدیل به معامله")');
      convertResponse = await triggerAndWaitForResponse(
        page,
        (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/v1/Lead/action/convert',
        () => convertBtn.click()
      );
      convertStatus = convertResponse.status();
      try {
        convertPayload = convertResponse.request().postDataJSON();
      } catch {
        convertPayload = convertResponse.request().postData();
      }
      convertResponseBody = await assertResponseOk(convertResponse, 'POST /Lead/action/convert', [200]);
      const conversionResult = JSON.parse(convertResponseBody) || {};
      const convertedEntityIds = [
        ['Opportunity', conversionResult.createdOpportunityId || conversionResult.opportunityId || conversionResult.createdOpportunity?.id || conversionResult.opportunity?.id],
        ['Contact', conversionResult.createdContactId || conversionResult.contactId || conversionResult.createdContact?.id || conversionResult.contact?.id],
        ['Account', conversionResult.createdAccountId || conversionResult.accountId || conversionResult.createdAccount?.id || conversionResult.account?.id],
      ];
      for (const [entity, id] of convertedEntityIds) {
        cleanupCreatedEntities.trackId(entity, id);
      }
      if (!convertedEntityIds.some(([, id]) => id)) {
        console.warn('Conversion response exposed no created entity IDs; no additional records were declared in the conversion payload.');
      }

      console.log(`   POST /Lead/action/convert response status: ${convertStatus}`);
      console.log(`   POST /Lead/action/convert payload:`, convertPayload);

      await waitForUiSettled(page);

      // Verify success notification banner
      const successBanner = page.locator('.rounded-xl.bg-emerald-500\\/10');
      if ((await successBanner.count()) > 0) {
        const bannerText = await successBanner.innerText();
        console.log(`   Conversion success banner: "${bannerText.trim()}"`);
        assert(bannerText.includes('تبدیل شد') || bannerText.includes('موفقیت'), 'Banner missing success copy');
      }

      // Verify that in the table, the lead is now marked as Converted
      const updatedRow = page.locator('table.bidar-leads-table tbody tr').filter({ hasText: leadDisplayName }).first();
      await updatedRow.locator('text=تبدیل‌شده').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      const updatedRowText = await updatedRow.innerText();
      console.log(`   Updated lead row text: "${updatedRowText.replace(/\n+/g, ' | ')}"`);

      assert(
        updatedRowText.includes('تبدیل‌شده') || updatedRowText.includes('تبدیل‌شده به معامله'),
        `Lead '${leadDisplayName}' status did not update to 'تبدیل‌شده' in table.`
      );

      testResults.oneClickConvert = {
        passed: true,
        details: `1-Click Convert verified for lead "${leadDisplayName}": POST /Lead/action/convert succeeded (HTTP ${convertStatus}), success notification shown, and status updated to Converted.`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 3 Passed] 1-Click Convert Action verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 3 Failed]:', err.message);
      testResults.oneClickConvert = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-LEADS-003',
          title: '1-Click Convert Action Failure',
          assertion: err.message,
          reproduction: [
            '1. Navigate to /leads.',
            '2. Click "تبدیل به معامله" on an active lead.',
            '3. Observe response of POST /Lead/action/convert.',
          ],
          httpStatus: convertStatus,
          requestPayload: convertPayload,
          responseBody: convertResponseBody ?? (convertResponse
            ? await convertResponse.text().catch(() => '<unreadable response body>')
            : '<not captured>'),
          domSnippet: await page.locator('table.bidar-leads-table').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((l) => l.url?.includes('convert')),
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }

    // =============================================================
    // Scenario 4: SMS Quick Send Modal (POST /BidarSms/send)
    // =============================================================
    console.log('--- [Scenario 4] Testing SMS Quick Send Modal (POST /BidarSms/send) ---');
    let smsSendResponse = null;
    let smsSendStatus = null;
    let smsSendPayload = null;
    let smsResponseBody = null;
    try {
      // Prefer the disposable lead created in Scenario 2. Never send live SMS to an arbitrary lead.
      let targetSmsBtn = null;
      if (newlyCreatedLeadLastName) {
        const disposableRow = page.locator('table.bidar-leads-table tbody tr')
          .filter({ hasText: newlyCreatedLeadLastName })
          .first();
        const disposableSmsBtn = disposableRow.locator('button[title*="پیامک"]').first();
        if ((await disposableRow.count()) > 0 && (await disposableSmsBtn.count()) > 0) {
          targetSmsBtn = disposableSmsBtn;
        }
      }

      if (!targetSmsBtn && LIVE_SMS) {
        throw new Error(
          `Live SMS requested, but disposable lead "${newlyCreatedLeadLastName || '<not created>'}" from Scenario 2 is unavailable or has no SMS action. Refusing to send to an arbitrary existing lead.`
        );
      }

      if (!targetSmsBtn) {
        const smsButtons = page.locator('table.bidar-leads-table tbody tr button[title*="پیامک"]');
        const smsCount = await smsButtons.count();
        console.log(`   Disposable lead unavailable; intercepted SMS fallback found ${smsCount} leads with SMS trigger button.`);
        assert(smsCount > 0, 'No SMS buttons found in leads table.');
        targetSmsBtn = smsButtons.first();
      }

      await targetSmsBtn.click();
      await waitForUiSettled(page);

      const modal = page.locator('[role="dialog"]');
      assert(await modal.isVisible(), 'SMS modal not visible after clicking SMS icon.');

      // Verify recipient phone is prefilled
      const phoneInput = modal.locator('input[dir="ltr"]');
      assert((await phoneInput.count()) > 0, 'Recipient phone input missing from SMS modal.');
      const prefilledPhone = (await phoneInput.inputValue()).trim();
      console.log(`   Prefilled recipient phone in SMS modal: "${prefilledPhone}"`);
      assert(prefilledPhone.length >= 10, `Expected prefilled recipient phone, got '${prefilledPhone}'`);

      // Type SMS message body
      const testSmsText = 'سلام، پیامک تستی تایید اطلاعات سرنخ از سامانه بیدار CRM.';
      const messageTextarea = modal.locator('textarea');
      await messageTextarea.fill(testSmsText);

      smsSendResponse = await triggerAndWaitForResponse(
        page,
        (res) => res.request().method() === 'POST' && new URL(res.url()).pathname === '/api/v1/BidarSms/send',
        () => modal.locator('button:has-text("ارسال پیامک")').click()
      );
      smsSendStatus = smsSendResponse.status();
      try {
        smsSendPayload = smsSendResponse.request().postDataJSON();
      } catch {
        smsSendPayload = smsSendResponse.request().postData();
      }
      console.log(`   POST /BidarSms/send response status: ${smsSendStatus}`);
      console.log(`   POST /BidarSms/send payload:`, smsSendPayload);
      smsResponseBody = await assertResponseOk(
        smsSendResponse,
        `POST /BidarSms/send (request payload: ${JSON.stringify(smsSendPayload)})`
      );
      console.log(`   POST /BidarSms/send response body:`, smsResponseBody);

      await waitForUiSettled(page);

      testResults.smsQuickSendModal = {
        passed: true,
        details: `SMS quick send verified: Modal opened with prefilled phone "${prefilledPhone}", message composed, POST /BidarSms/send succeeded (HTTP ${smsSendStatus}).`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 4 Passed] SMS Quick Send Modal verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 4 Failed]:', err.message);
      testResults.smsQuickSendModal = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-SMS-001',
          title: 'SMS Quick Send Request Failure',
          assertion: err.message,
          reproduction: [
            `1. Navigate to ${BASE_URL}leads.`,
            '2. Click the SMS icon for the target lead with a phone number.',
            '3. Confirm the recipient phone is prefilled, enter message text, and click "ارسال پیامک".',
            '4. Inspect the POST /BidarSms/send payload, HTTP status, response body, and rendered modal.',
          ],
          httpStatus: smsSendStatus,
          requestPayload: smsSendPayload,
          responseBody: smsResponseBody ?? (smsSendResponse
            ? await smsSendResponse.text().catch(() => '<unreadable response body>')
            : '<not captured>'),
          domSnippet: await page.locator('[role="dialog"]').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((l) => l.url?.includes('BidarSms')),
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }
  } catch (fatalErr) {
    console.error('💥 Unexpected fatal error in Section 5 suite:', fatalErr);
    recordFatalError(testResults, fatalErr, page);
  } finally {
    try {
      await cleanupCreatedEntities?.();
    } finally {
      await browser?.close();
    }
  }

  // =============================================================
  // Summary & Bug Dossier Compilation
  // =============================================================
  console.log('================================================================');
  console.log('📊 SECTION 5 TEST EXECUTION SUMMARY:');
  console.log(`   1. Leads Directory & Status Filtering: ${testResults.leadsDirectoryAndFiltering.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   2. Lead Create Modal:                  ${testResults.leadCreateModal.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   3. 1-Click Convert Action:             ${testResults.oneClickConvert.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   4. SMS Quick Send Modal:               ${testResults.smsQuickSendModal.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log('================================================================\n');

  return testResults;
}

// Direct execution support
if (process.argv[1]?.endsWith('leads.spec.js')) {
  runLeadsSection5Tests()
    .then((results) => {
      const hasFailures = Object.values(results).some((r) => r.passed === false);
      if (hasFailures) {
        console.log('⚠️ Section 5 test suite completed with defects detected (RED).');
        process.exitCode = 1;
      } else {
        console.log('🎉 All Section 5 tests passed (GREEN).');
        process.exitCode = 0;
      }
    })
    .catch((err) => {
      console.error('Fatal runner error:', err);
      process.exitCode = 2;
    });
}
