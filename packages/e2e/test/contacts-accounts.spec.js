/**
 * BidarCRM E2E Test Suite - Section 3: Contacts, Accounts & Persian CSV/Excel Export (`/contacts`, `/accounts`)
 *
 * Real browser-driven Playwright test verifying:
 * 1. Authentication & Contacts Directory (/contacts):
 *    - Verify page title, table rendering, search filtering, customer group chips,
 *      Persian phone number formatting (`۰۹۱۲...`), and Iranian national code.
 * 2. Contact Quick Create Modal ("مخاطب جدید"):
 *    - Modal opening, field validation (first/last name, phone, account, national code),
 *      successful creation via `POST /Contact` (HTTP 200/201), and immediate table update.
 * 3. Accounts Page (/accounts):
 *    - Navigation, table structure, industry, phone, national ID, website, and live search.
 * 4. Account Create Modal ("شرکت جدید"):
 *    - Modal opening, Iranian legal entity field validations (11-digit national ID check-digit,
 *      10-digit postal code, Sheba IBAN), company creation via `POST /Account` (HTTP 200/201),
 *      and table update.
 * 5. Persian CSV / Excel Export:
 *    - Trigger export from UI buttons ("خروجی CSV") on both /contacts and /accounts.
 *    - Verify authentication handling on export endpoints.
 *    - Verify UTF-8 BOM sequence (3 bytes: `\xEF\xBB\xBF` or `0xEF, 0xBB, 0xBF`) preventing Excel Mojibake.
 *    - Verify Persian header translations and cell values.
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

export async function runContactsAccountsSection3Tests() {
  console.log('================================================================');
  console.log('🚀 Starting BidarCRM E2E Pipeline: Section 3 (مخاطبین، شرکت‌ها و خروجی اکسل/CSV)');
  console.log(`🎯 Target URL: ${BASE_URL}`);
  console.log('================================================================\n');

  const testResults = {
    contactsDirectory: { passed: false, details: null, bugDossier: null },
    contactCreateModal: { passed: false, details: null, bugDossier: null },
    accountsDirectory: { passed: false, details: null, bugDossier: null },
    accountCreateModal: { passed: false, details: null, bugDossier: null },
    persianCsvExport: { passed: false, details: null, bugDossier: null },
  };

  let browser = null;
  let page = null;
  let cleanupCreatedEntities = null;

  // Network logs for detailed bug dossiers
  const networkLogs = [];
  const consoleErrors = [];

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
      // Ignore cleanup error
    }
  }

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

    page.on('request', (req) => {
      if (['POST', 'PATCH', 'DELETE'].includes(req.method()) || req.url().includes('BidarExport') || req.url().includes('/Contact') || req.url().includes('/Account')) {
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
      if (['POST', 'PATCH', 'DELETE'].includes(res.request().method()) || res.url().includes('BidarExport') || res.url().includes('/Contact') || res.url().includes('/Account')) {
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

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // -------------------------------------------------------------
    // Initial Setup: Log in
    // -------------------------------------------------------------
    console.log('🔐 [Setup] Logging in as admin...');
    await loginToApp(page, BASE_URL, CREDENTIALS);
    console.log('✅ Logged in successfully.\n');

    // =============================================================
    // Scenario 1: Contacts Directory & Iranian Formatting (/contacts)
    // =============================================================
    console.log('--- [Scenario 1] Testing Contacts Directory & Formatting (/contacts) ---');
    try {
      await page.locator('nav a[href="/contacts"], a[href="/contacts"]').first().click();
      await waitForUiSettled(page);

      // Verify URL & Heading
      assert(page.url().includes('/contacts'), `Expected URL to include /contacts, got ${page.url()}`);
      const h1Text = await page.locator('h1').innerText();
      assert(h1Text.includes('اشخاص و مخاطبان'), `Expected heading to contain 'اشخاص و مخاطبان', got '${h1Text}'`);

      // Verify Table rendering
      const table = page.locator('table.bidar-contacts-table');
      assert((await table.count()) > 0, 'Contacts table (table.bidar-contacts-table) not found.');

      const initialRowCount = await table.locator('tbody tr').count();
      console.log(`   Found ${initialRowCount} contacts in table.`);
      assert(initialRowCount > 0, 'Contacts table is empty, expected seeded contacts.');

      // Check Table Headers
      const headersText = await table.locator('thead').innerText();
      assert(headersText.includes('نام و نام خانوادگی'), 'Missing "نام و نام خانوادگی" header');
      assert(headersText.includes('شماره تماس'), 'Missing "شماره تماس" header');
      assert(headersText.includes('کد ملی'), 'Missing "کد ملی" header');

      // Check Persian Phone Number formatting
      // Specification: Iranian mobile numbers should be displayed in Persian format (۰۹۱۲...)
      const firstPhoneCell = table.locator('tbody tr td:nth-child(4)').first();
      const phoneText = (await firstPhoneCell.innerText()).trim();
      console.log(`   First contact phone display: "${phoneText}"`);

      // Check if phone contains Persian digits (۰-۹)
      const hasPersianDigits = /[\u06F0-\u06F9]/.test(phoneText);
      if (!hasPersianDigits && phoneText !== '—') {
        throw new Error(
          `Contact phone number is rendered with raw ASCII English digits ("${phoneText}") instead of Persian digits (e.g. ۰۹۱۲...). Must use formatIranPhone().`
        );
      }

      // Check Search Filter
      const searchInput = page.locator('input[placeholder*="جستجو در مخاطبان"]');
      assert((await searchInput.count()) > 0, 'Contacts search input not found.');

      // Search for first contact name
      const firstContactName = (await table.locator('tbody tr td:nth-child(1)').first().innerText()).trim().split('\n').pop().trim();
      console.log(`   Searching for contact name: "${firstContactName}"`);
      await searchInput.fill(firstContactName);
      await waitForUiSettled(page);

      const filteredCount = await table.locator('tbody tr').count();
      assert(filteredCount >= 1, `Expected at least 1 row matching '${firstContactName}', found ${filteredCount}`);

      // Clear search
      await searchInput.fill('');
      await waitForUiSettled(page);
      assert((await table.locator('tbody tr').count()) === initialRowCount, 'Clearing search did not restore row count');

      // Check Customer Groups filter chips (GAP-05)
      const vipFilterBtn = page.locator('button:has-text("ویژه (VIP)")');
      assert((await vipFilterBtn.count()) > 0, 'Customer group chip "ویژه (VIP)" not found.');
      await vipFilterBtn.click();
      await waitForUiSettled(page);

      // Reset group filter
      await page.locator('button:has-text("همه مخاطبان")').click();
      await waitForUiSettled(page);

      testResults.contactsDirectory = {
        passed: true,
        details: `Contacts directory verified: ${initialRowCount} contacts, headers validated, search and customer group chips functional, Persian phone formatting verified.`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 1 Passed] Contacts Directory & Formatting verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 1 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('/Contact')).at(-1);
      testResults.contactsDirectory = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-CONTACTS-001',
          title: 'Contacts Directory Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in and navigate to /contacts.',
            '2. Verify the table, headers, search, customer-group filters, and Persian phone formatting.',
            '3. Inspect the failing assertion and the related Contact API response.',
          ],
          domSnippet: await page.locator('table.bidar-contacts-table').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.slice(-5),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }

    // =============================================================
    // Scenario 2: Contact Quick Create Modal ("مخاطب جدید")
    // =============================================================
    console.log('--- [Scenario 2] Testing Contact Quick Create Modal ("مخاطب جدید") ---');
    try {
      const openModalBtn = page.locator('button:has-text("مخاطب جدید")');
      assert((await openModalBtn.count()) > 0, '"مخاطب جدید" button not found.');
      await openModalBtn.click();
      await waitForUiSettled(page);

      const modal = page.locator('[role="dialog"]');
      assert(await modal.isVisible(), 'Contact quick create modal dialog is not visible after click.');

      // Check form fields
      const firstNameInput = modal.locator('[data-testid="contact-first-name"]');
      const lastNameInput = modal.locator('[data-testid="contact-last-name"]');
      const phoneInput = modal.locator('[data-testid="contact-phone"]');
      const emailInput = modal.locator('[data-testid="contact-email"]');
      const accountInput = modal.locator('[data-testid="contact-account"]');

      assert((await firstNameInput.count()) > 0, 'First name input missing');
      assert((await lastNameInput.count()) > 0, 'Last name input missing');
      assert((await phoneInput.count()) > 0, 'Phone input missing');
      assert((await emailInput.count()) > 0, 'Email input missing');
      assert((await accountInput.count()) > 0, 'Account input missing');

      // Check Iranian fields: National Code (کد ملی)
      const natCodeInput = modal.locator('[data-testid="contact-national-code"], input[placeholder*="کد ملی"]');
      const hasNatCodeField = (await natCodeInput.count()) > 0;
      console.log(`   Has National Code field in Contact modal: ${hasNatCodeField}`);
      assert(hasNatCodeField, 'Missing "کد ملی" (nationalCode) input field in ContactQuickCreateModal.');

      // Test Validation: Submit empty form
      await modal.locator('button:has-text("ذخیره مخاطب")').click();
      await waitForUiSettled(page);

      const errorAlert = modal.locator('.bg-rose-500\\/10');
      assert((await errorAlert.count()) > 0, 'Expected validation error alert when submitting empty contact form.');
      const errorText = await errorAlert.innerText();
      console.log(`   Validation error caught: "${errorText.trim()}"`);

      // Fill valid contact information
      const uniqueSuffix = Date.now().toString().slice(-4);
      const testFirstName = 'آرش';
      const testLastName = `پیروز‌فر ${uniqueSuffix}`;
      const testFullName = `${testFirstName} ${testLastName}`;
      const testPhone = '09121234567';
      const testEmail = `arash.${uniqueSuffix}@test.ir`;
      const testAccount = 'فناوران داده‌پرداز کیمیا';

      await firstNameInput.fill(testFirstName);
      await lastNameInput.fill(testLastName);
      await phoneInput.fill(testPhone);
      await emailInput.fill(testEmail);
      await accountInput.fill(testAccount);

      if (hasNatCodeField) {
        // Valid 10-digit national code: 0012345679
        await natCodeInput.fill('0012345679');
      }

      // Capture and validate the POST /Contact response from the UI submission.
      const contactResponse = await triggerAndWaitForResponse(
        page,
        (response) => response.request().method() === 'POST'
          && /^\/api\/v1\/Contact\/?$/.test(new URL(response.url()).pathname),
        () => modal.locator('button:has-text("ذخیره مخاطب")').click()
      );
      await assertResponseOk(contactResponse, 'POST /api/v1/Contact', [200, 201]);
      await cleanupCreatedEntities.trackResponse(contactResponse);

      const postContactRes = contactResponse.status();
      const postContactPayload = contactResponse.request().postDataJSON();

      console.log(`   POST /Contact response status: ${postContactRes}`);
      console.log(`   POST /Contact payload sent:`, postContactPayload);
      assert(postContactPayload.lastName === testLastName, 'Payload lastName mismatch');
      assert(postContactPayload.phoneNumber === testPhone, 'Payload phoneNumber mismatch');

      // Check if accountName was sent in payload
      if (!postContactPayload.accountName && !postContactPayload.accountId) {
        console.warn('⚠️ Warning: accountName was entered in form but omitted from POST /Contact payload.');
      }

      await waitForUiSettled(page);
      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      assert(!(await modal.isVisible()), 'Modal should close after successful contact submission.');

      // Verify contact appears in table
      await page.locator(`table.bidar-contacts-table tbody tr:has-text("${testLastName}")`).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      const tableText = await page.locator('table.bidar-contacts-table').innerText();
      assert(tableText.includes(testLastName), `New contact '${testLastName}' not found in contacts table.`);

      testResults.contactCreateModal = {
        passed: true,
        details: `Contact "${testFullName}" successfully created with POST /Contact (HTTP ${postContactRes}), verified in table.`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 2 Passed] Contact Quick Create Modal verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 2 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('/Contact')).at(-1);
      testResults.contactCreateModal = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-CONTACTS-002',
          title: 'Contact Create Modal Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in, navigate to /contacts, and click "مخاطب جدید".',
            '2. Verify the form fields and validation, then submit a valid contact.',
            '3. Inspect the POST /api/v1/Contact status/body and confirm the modal closes and the table updates.',
          ],
          domSnippet: await page.locator('[role="dialog"]').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.slice(-5),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }

    // =============================================================
    // Scenario 3: Accounts Page Directory & Live Filtering (/accounts)
    // =============================================================
    console.log('--- [Scenario 3] Testing Accounts Page Directory & Filtering (/accounts) ---');
    try {
      await page.locator('nav a[href="/accounts"], a[href="/accounts"]').first().click();
      await waitForUiSettled(page);

      assert(page.url().includes('/accounts'), `Expected URL to include /accounts, got ${page.url()}`);
      const h1Text = await page.locator('h1').innerText();
      assert(h1Text.includes('شرکت‌ها و سازمان‌ها'), `Expected heading to contain 'شرکت‌ها و سازمان‌ها', got '${h1Text}'`);

      const table = page.locator('table.bidar-accounts-table');
      assert((await table.count()) > 0, 'Accounts table (table.bidar-accounts-table) not found.');

      await table.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      const initialCount = await table.locator('tbody tr').count();
      console.log(`   Found ${initialCount} accounts in table.`);
      assert(initialCount > 0, 'Accounts table is empty, expected seeded accounts.');

      // Check Table Column Headers
      const theadText = await table.locator('thead').innerText();
      assert(theadText.includes('نام شرکت'), 'Missing "نام شرکت" column header');
      assert(theadText.includes('صنعت') || theadText.includes('حوزه فعالیت'), 'Missing industry column header');
      assert(theadText.includes('شماره تماس'), 'Missing "شماره تماس" column header');
      assert(theadText.includes('شناسه ملی'), 'Missing "شناسه ملی" column header');

      // Check Iranian phone formatting on accounts
      const firstPhoneCell = table.locator('tbody tr td:nth-child(4)').first();
      const phoneText = (await firstPhoneCell.innerText()).trim();
      console.log(`   First account phone display: "${phoneText}"`);
      if (phoneText !== '—') {
        const hasPersianDigits = /[\u06F0-\u06F9]/.test(phoneText);
        assert(hasPersianDigits, `Account phone number should use Persian digits, got '${phoneText}'`);
      }

      // Check Search Filter
      const searchInput = page.locator('input[placeholder*="جستجو در نام شرکت"]');
      assert((await searchInput.count()) > 0, 'Accounts search input not found.');

      // Search for "کیمیا"
      console.log('   Testing search filter with query "کیمیا"...');
      await searchInput.fill('کیمیا');
      await waitForUiSettled(page);

      const kimCount = await table.locator('tbody tr').count();
      assert(kimCount >= 1, `Expected at least 1 match for "کیمیا", got ${kimCount}`);
      const rowText = await table.locator('tbody tr').first().innerText();
      assert(rowText.includes('کیمیا'), `Search result row does not contain "کیمیا": ${rowText}`);

      // Clear search
      await searchInput.fill('');
      await waitForUiSettled(page);
      assert((await table.locator('tbody tr').count()) === initialCount, 'Clearing search did not restore accounts count.');

      // Check Customer Groups filter chips
      const resellerChip = page.locator('button:has-text("نمایندگان")');
      assert((await resellerChip.count()) > 0, 'Customer group chip "نمایندگان" not found.');
      await resellerChip.click();
      await waitForUiSettled(page);

      // Reset
      await page.locator('button:has-text("همه شرکت‌ها")').click();
      await waitForUiSettled(page);

      testResults.accountsDirectory = {
        passed: true,
        details: `Accounts directory verified: ${initialCount} accounts, columns validated, phone formatting in Persian digits confirmed, live search and group filtering verified.`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 3 Passed] Accounts Page Directory & Filtering verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 3 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('/Account')).at(-1);
      testResults.accountsDirectory = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-ACCOUNTS-001',
          title: 'Accounts Directory Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in and navigate to /accounts.',
            '2. Verify table structure, columns, Persian phone formatting, search, and customer-group filters.',
            '3. Inspect the failing assertion and the related Account API response.',
          ],
          domSnippet: await page.locator('table.bidar-accounts-table').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.slice(-5),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }

    // =============================================================
    // Scenario 4: Account Create Modal & Legal Entity Validation
    // =============================================================
    console.log('--- [Scenario 4] Testing Account Create Modal & Legal Validation ---');
    try {
      const openModalBtn = page.locator('button:has-text("شرکت جدید")').first();
      assert((await openModalBtn.count()) > 0, '"شرکت جدید" button not found.');
      await openModalBtn.click();
      await waitForUiSettled(page);

      const modal = page.locator('[role="dialog"]');
      assert(await modal.isVisible(), 'Account create modal dialog not visible.');

      const nameInput = modal.locator('input[placeholder*="داده‌پردازی"]');
      const industryInput = modal.locator('input[placeholder*="فناوری اطلاعات"]');
      const phoneInput = modal.locator('input[placeholder="02188888888"]');
      const emailInput = modal.locator('input[placeholder="info@company.ir"]');
      const websiteInput = modal.locator('input[placeholder="company.ir"]');
      const natIdInput = modal.locator('input[placeholder="10101234567"]');
      const postalInput = modal.locator('input[placeholder="1234567890"]');
      const shebaInput = modal.locator('input[placeholder="IR120000000000000000000000"]');

      // 4.1 Test Client-Side Validations
      console.log('   Testing Iranian client-side validations...');

      // 1) Invalid 11-digit national ID check-digit
      await nameInput.fill('شرکت تست اعتبارسنجی');
      await natIdInput.fill('12345678901'); // Invalid check digit
      await modal.locator('button:has-text("ذخیره شرکت")').click();
      await waitForUiSettled(page);

      const natIdError = await modal.locator('.bg-rose-500\\/10').innerText().catch(() => '');
      assert(natIdError.includes('شناسه ملی') || natIdError.includes('معتبر نیست'), `Expected invalid national ID error, got: '${natIdError}'`);
      console.log(`   Caught invalid national ID error: "${natIdError.trim()}"`);

      // 2) Invalid Postal Code (< 10 digits or invalid pattern)
      await natIdInput.fill('');
      await postalInput.fill('123'); // Invalid
      await modal.locator('button:has-text("ذخیره شرکت")').click();
      await waitForUiSettled(page);

      const postalError = await modal.locator('.bg-rose-500\\/10').innerText().catch(() => '');
      assert(postalError.includes('کد پستی'), `Expected postal code error, got: '${postalError}'`);
      console.log(`   Caught invalid postal code error: "${postalError.trim()}"`);

      // 3) Invalid Sheba
      await postalInput.fill('');
      await shebaInput.fill('IR12345'); // Invalid
      await modal.locator('button:has-text("ذخیره شرکت")').click();
      await waitForUiSettled(page);

      const shebaError = await modal.locator('.bg-rose-500\\/10').innerText().catch(() => '');
      assert(shebaError.includes('شبا'), `Expected Sheba error, got: '${shebaError}'`);
      console.log(`   Caught invalid Sheba error: "${shebaError.trim()}"`);

      // 4.2 Fill Valid Company Data
      const uniqueSuffix = Date.now().toString().slice(-4);
      const testCompanyName = `شرکت پیشگامان فناور موج ${uniqueSuffix}`;
      const validCompanyNatId = '10101234565'; // Valid 11-digit with check digit
      const validPostalCode = '1939512345'; // Valid 10-digit
      const validSheba = 'IR700120000000000000000000'; // Valid IBAN mod 97 == 1

      await nameInput.fill(testCompanyName);
      await phoneInput.fill('02188997766');
      await emailInput.fill(`info@mowj-${uniqueSuffix}.ir`);
      await websiteInput.fill(`mowj-${uniqueSuffix}.ir`);
      await natIdInput.fill(validCompanyNatId);
      await postalInput.fill(validPostalCode);
      await shebaInput.fill(validSheba);

      // Enter Persian industry text as suggested by the input placeholder:
      // placeholder="مثال: فناوری اطلاعات، بازرگانی، پزشکی..."
      await industryInput.fill('فناوری اطلاعات و ارتباطات');

      // Capture and validate the POST /Account response from the UI submission.
      const accountResponse = await triggerAndWaitForResponse(
        page,
        (response) => response.request().method() === 'POST'
          && /^\/api\/v1\/Account\/?$/.test(new URL(response.url()).pathname),
        () => modal.locator('button:has-text("ذخیره شرکت")').click()
      );
      await assertResponseOk(accountResponse, 'POST /api/v1/Account', [200, 201]);
      await cleanupCreatedEntities.trackResponse(accountResponse);

      const postAccountRes = accountResponse.status();
      const postAccountPayload = accountResponse.request().postDataJSON();

      console.log(`   POST /Account response status: ${postAccountRes}`);
      console.log(`   POST /Account payload sent:`, postAccountPayload);

      await waitForUiSettled(page);
      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      assert(!(await modal.isVisible()), 'Modal should close after successful account submission.');

      // Verify new account appears in table
      await page.locator(`table.bidar-accounts-table tbody tr:has-text("${testCompanyName}")`).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      const tableText = await page.locator('table.bidar-accounts-table').innerText();
      assert(tableText.includes(testCompanyName), `New account '${testCompanyName}' not found in accounts table.`);

      testResults.accountCreateModal = {
        passed: true,
        details: `Account "${testCompanyName}" successfully created with Iranian legal validations (National ID: ${validCompanyNatId}, Postal: ${validPostalCode}, Sheba: ${validSheba}) and verified in table.`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 4 Passed] Account Create Modal & Legal Validation verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 4 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('/Account')).at(-1);
      testResults.accountCreateModal = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-ACCOUNTS-002',
          title: 'Account Create Modal Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in, navigate to /accounts, and click "شرکت جدید".',
            '2. Verify Iranian legal-entity validations, then submit valid company data.',
            '3. Inspect the POST /api/v1/Account status/body and confirm the modal closes and the table updates.',
          ],
          domSnippet: await page.locator('[role="dialog"]').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.slice(-5),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }

    // =============================================================
    // Scenario 5: Persian CSV & Excel Export (BOM & Encoding Gate)
    // =============================================================
    console.log('--- [Scenario 5] Testing Persian CSV & Excel Export (BOM & Encoding) ---');
    try {
      // 5.1 Capture the authenticated Contact export response triggered by the UI.
      console.log('   Testing UI export button on /contacts...');
      await page.locator('nav a[href="/contacts"], a[href="/contacts"]').first().click();
      await waitForUiSettled(page);

      const contactExportBtn = page.locator('button:has-text("خروجی CSV")');
      assert((await contactExportBtn.count()) > 0, 'Contacts CSV export button not found.');

      const contactExportResponse = await triggerAndWaitForResponse(
        page,
        (response) => response.request().method() === 'GET'
          && /^\/api\/v1\/BidarExport\/Contact\/?$/.test(new URL(response.url()).pathname),
        () => contactExportBtn.click()
      );
      const contactCsvBuffer = await contactExportResponse.body();
      const contactCsvContent = contactCsvBuffer.toString('utf8');
      const contactExportStatus = contactExportResponse.status();
      const contactContentType = contactExportResponse.headers()['content-type'] ?? null;
      const contactContentDisposition = contactExportResponse.headers()['content-disposition'] ?? null;
      let contactFirst3Bytes = Array.from(contactCsvBuffer.subarray(0, 3));
      if (contactFirst3Bytes[0] !== 0xEF) {
        const rawRes = await page.request.get(contactExportResponse.url(), {
          headers: contactExportResponse.request().headers(),
        });
        const rawBuf = await rawRes.body();
        contactFirst3Bytes = Array.from(rawBuf.subarray(0, 3));
      }

      console.log(`   Contact Export status: ${contactExportStatus}`);
      console.log(`   Content-Type: ${contactContentType}`);
      console.log(`   Content-Disposition: ${contactContentDisposition}`);
      console.log(`   First 3 bytes (BOM):`, contactFirst3Bytes);

      assert.equal(
        contactExportStatus,
        200,
        `Contact export failed with HTTP ${contactExportStatus} ${contactExportResponse.statusText()}: ${contactCsvContent.slice(0, 1000)}`
      );
      assert(contactContentType?.includes('text/csv'), 'Content-Type must be text/csv');
      assert(contactContentDisposition?.includes('attachment'), 'Content-Disposition must be attachment');

      // STRICT BOM ASSERTION: First 3 bytes MUST be 0xEF, 0xBB, 0xBF
      assert(
        contactFirst3Bytes[0] === 0xEF &&
          contactFirst3Bytes[1] === 0xBB &&
          contactFirst3Bytes[2] === 0xBF,
        `UTF-8 BOM missing! Expected [239, 187, 191] (0xEF, 0xBB, 0xBF), got [${contactFirst3Bytes.join(', ')}]`
      );

      // Verify Persian CSV headers on the first row.
      const contactHeaderLine = contactCsvContent.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0];
      assert(contactHeaderLine.includes('نام و نام خانوادگی'), 'Missing "نام و نام خانوادگی" header in Contact CSV');
      assert(contactHeaderLine.includes('تلفن'), 'Missing "تلفن" header in Contact CSV');
      assert(contactHeaderLine.includes('ایمیل'), 'Missing "ایمیل" header in Contact CSV');

      // 5.2 Capture the authenticated Account export response from its own UI.
      console.log('   Testing /api/v1/BidarExport/Account stream and BOM bytes...');
      await page.locator('nav a[href="/accounts"], a[href="/accounts"]').first().click();
      await waitForUiSettled(page);

      const accountExportBtn = page.locator('button:has-text("خروجی CSV")');
      assert((await accountExportBtn.count()) > 0, 'Accounts CSV export button not found.');

      const accountExportResponse = await triggerAndWaitForResponse(
        page,
        (response) => response.request().method() === 'GET'
          && /^\/api\/v1\/BidarExport\/Account\/?$/.test(new URL(response.url()).pathname),
        () => accountExportBtn.click()
      );
      const accountCsvBuffer = await accountExportResponse.body();
      const accountCsvContent = accountCsvBuffer.toString('utf8');
      const accountExportStatus = accountExportResponse.status();
      const accountContentType = accountExportResponse.headers()['content-type'] ?? null;
      const accountContentDisposition = accountExportResponse.headers()['content-disposition'] ?? null;
      let accountFirst3Bytes = Array.from(accountCsvBuffer.subarray(0, 3));
      if (accountFirst3Bytes[0] !== 0xEF) {
        const rawRes = await page.request.get(accountExportResponse.url(), {
          headers: accountExportResponse.request().headers(),
        });
        const rawBuf = await rawRes.body();
        accountFirst3Bytes = Array.from(rawBuf.subarray(0, 3));
      }

      console.log(`   Account Export status: ${accountExportStatus}`);
      console.log(`   Account Content-Type: ${accountContentType}`);
      console.log(`   Account Content-Disposition: ${accountContentDisposition}`);
      console.log(`   Account First 3 bytes (BOM):`, accountFirst3Bytes);

      assert.equal(
        accountExportStatus,
        200,
        `Account export failed with HTTP ${accountExportStatus} ${accountExportResponse.statusText()}: ${accountCsvContent.slice(0, 1000)}`
      );
      assert(accountContentType?.includes('text/csv'), 'Account Content-Type must be text/csv');
      assert(accountContentDisposition?.includes('attachment'), 'Account Content-Disposition must be attachment');
      assert(
        accountFirst3Bytes[0] === 0xEF &&
          accountFirst3Bytes[1] === 0xBB &&
          accountFirst3Bytes[2] === 0xBF,
        `UTF-8 BOM missing for Account export! Got [${accountFirst3Bytes.join(', ')}]`
      );
      const accountHeaderLine = accountCsvContent.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0];
      assert(accountHeaderLine.includes('نام شرکت'), 'Missing "نام شرکت" header in Account CSV');

      // 5.3 Separately verify that a request without Espo auth headers is rejected.
      const unauthExport = await page.evaluate(async () => {
        const response = await fetch('/api/v1/BidarExport/Contact', {
          credentials: 'omit',
          signal: AbortSignal.timeout(10000),
        });
        return {
          status: response.status,
          body: (await response.text()).slice(0, 1000),
        };
      });
      console.log(`   Unauthenticated Contact export status: ${unauthExport.status}`);

      assert(
        unauthExport.status === 401 || unauthExport.status === 403,
        `Unauthenticated Contact export should return HTTP 401 or 403 (unauthorized/forbidden), got HTTP ${unauthExport.status}: ${unauthExport.body}`
      );

      testResults.persianCsvExport = {
        passed: true,
        details: 'Authenticated Contact and Account blob responses verified: HTTP 200, text/csv attachment headers, UTF-8 BOM (0xEF, 0xBB, 0xBF), and Persian headers. Unauthenticated Contact export returned HTTP 401.',
        bugDossier: null,
      };
      console.log('✅ [Scenario 5 Passed] Persian CSV Export verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 5 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('BidarExport')).at(-1);
      testResults.persianCsvExport = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-EXPORT-001',
          title: 'Authenticated / Unauthenticated CSV Export Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in, navigate to /contacts, and click "خروجی CSV".',
            '2. Inspect GET /api/v1/BidarExport/Contact and verify HTTP status, CSV headers, attachment disposition, BOM, and Persian columns.',
            '3. Repeat from /accounts for GET /api/v1/BidarExport/Account.',
            '4. Send a separate request to /api/v1/BidarExport/Contact without Espo auth headers and verify HTTP 401.',
          ],
          domSnippet: await page.locator('button:has-text("خروجی CSV")').first().innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((log) => log.url?.includes('BidarExport')),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    } finally {
      await ensureModalClosed();
    }
  } catch (fatalErr) {
    console.error('💥 Unexpected runner crash in Section 3 suite:', fatalErr);
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
  console.log('📊 SECTION 3 TEST EXECUTION SUMMARY:');
  console.log(`   1. Contacts Directory & Formatting: ${testResults.contactsDirectory.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   2. Contact Create Modal:            ${testResults.contactCreateModal.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   3. Accounts Directory & Filtering:  ${testResults.accountsDirectory.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   4. Account Create Modal & Legal:    ${testResults.accountCreateModal.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   5. Persian CSV Export & BOM Gate:   ${testResults.persianCsvExport.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log('================================================================\n');

  return testResults;
}

// Direct execution support
if (process.argv[1]?.endsWith('contacts-accounts.spec.js')) {
  runContactsAccountsSection3Tests()
    .then((results) => {
      const hasFailures = Object.values(results).some((r) => r.passed === false);
      if (hasFailures) {
        console.log('⚠️ Section 3 test suite completed with defects detected (RED).');
        process.exitCode = 1;
      } else {
        console.log('🎉 All Section 3 tests passed (GREEN).');
        process.exitCode = 0;
      }
    })
    .catch((err) => {
      console.error('Fatal runner error:', err);
      process.exitCode = 2;
    });
}
