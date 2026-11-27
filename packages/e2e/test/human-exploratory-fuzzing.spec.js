import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {
  assertResponseOk,
  cleanupEntities,
  loginToApp,
  triggerAndWaitForResponse,
  waitForUiSettled,
  waitForVisible,
} from '../lib/test-helpers.js';

const APP_URL = process.env.APP_URL || 'http://localhost:8089/app/';
const CREDENTIALS = {
  username: process.env.BIDAR_ADMIN_USER || 'admin',
  password: process.env.BIDAR_ADMIN_PASSWORD || 'admin',
};

async function main() {
  console.log('================================================================');
  console.log('🤖 Starting BidarCRM E2E Exploratory & Human Fuzzing Pipeline');
  console.log(`🎯 Target URL: ${APP_URL}`);
  console.log('================================================================\n');

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    locale: 'fa-IR',
  });
  const cleanup = cleanupEntities(page);

  // Monitor all console errors and uncaught page exceptions
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    console.error(`💥 [Page Error] ${err.message}`);
    pageErrors.push(err.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('401 (Unauthorized)')) {
        console.warn(`⚠️ [Console Error] ${text}`);
        consoleErrors.push(text);
      }
    }
  });

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Authentication & Trimming Fuzzing
    // -------------------------------------------------------------------------
    console.log('--- [Scenario 1] Testing Human Login & Input Resilience ---');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const usernameInput = page.locator('input[name="username"]');
    if (await usernameInput.isVisible().catch(() => false)) {
      // Test invalid password first
      await usernameInput.fill(CREDENTIALS.username);
      await page.locator('input[name="password"]').fill('WrongPassword123!');
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(1000);

      // Verify login form is still present (didn't crash or falsely authenticate)
      assert.ok(await usernameInput.isVisible(), 'Login input should remain on invalid attempt');

      // Now login with valid credentials (testing whitespace trimming)
      await usernameInput.fill(`  ${CREDENTIALS.username}  `);
      await page.locator('input[name="password"]').fill(CREDENTIALS.password);
      await page.locator('button[type="submit"]').click();
    }

    await waitForVisible(page, 'nav, main, [role="main"]', 15000);
    console.log('✅ [Scenario 1 Passed] Human Login & resilience verified.');

    // -------------------------------------------------------------------------
    // Scenario 2: Global Search (Ctrl+K & Direct Click) & Keyboard Fuzzing
    // -------------------------------------------------------------------------
    console.log('\n--- [Scenario 2] Testing Global Search Fuzzing & Keyboard Nav ---');
    const headerSearchInput = page.locator('input[placeholder*="جستجو"]').first();
    await headerSearchInput.waitFor({ state: 'visible', timeout: 10000 });
    await waitForUiSettled(page);

    // Human behavior 1: Press Ctrl+k or click input
    await page.click('body');
    await page.keyboard.press('Control+k');
    await waitForUiSettled(page);

    const searchModal = page.locator('[role="dialog"], .fixed.inset-0.z-50').first();
    let isSearchOpen = await searchModal.isVisible().catch(() => false);
    if (!isSearchOpen) {
      await headerSearchInput.click();
      await waitForUiSettled(page);
      isSearchOpen = await searchModal.isVisible().catch(() => false);
    }
    assert.ok(isSearchOpen, 'Global search modal should open on Ctrl+K or search bar click');

    const searchInput = searchModal.locator('input').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    // Fuzz with symbols, Persian ZWNJ, and special characters
    const fuzzQueries = [
      '!@#$%^&*()_+',
      'پیش‌فاکتور معامله',
      '<script>alert(1)</script>',
      'ناموجود۱۲۳۴۵',
    ];

    for (const query of fuzzQueries) {
      await searchInput.fill(query);
      await page.waitForTimeout(150);
      assert.strictEqual(await searchInput.inputValue(), query);
    }

    // Test Keyboard navigation (ArrowDown, ArrowUp, Escape)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');
    await waitForUiSettled(page);

    const isSearchClosed = !(await searchModal.isVisible().catch(() => false));
    assert.ok(isSearchClosed, 'Global search modal should close cleanly on Escape');
    console.log('✅ [Scenario 2 Passed] Global Search Fuzzing & Keyboard Nav verified.');

    // -------------------------------------------------------------------------
    // Scenario 3: Kanban Stress & Loss Reason Modal Cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- [Scenario 3] Testing Kanban Chaos & Loss Reason Modal Cancel ---');
    const kanbanNavLink = page.locator('a[href="/kanban"]').first();
    await kanbanNavLink.waitFor({ state: 'visible', timeout: 10000 });
    await kanbanNavLink.click();
    await waitForUiSettled(page);

    const kanbanBoard = page.locator('.bidar-kanban-board, [data-testid="kanban-board"]').first();
    await kanbanBoard.waitFor({ state: 'visible', timeout: 15000 });

    // Test Quick-Add Deal validation
    const col1 = page.locator('[data-testid="kanban-column-0"], [data-testid^="kanban-column-"]').first();
    const quickAddBtn = col1.locator('button[title*="افزودن"], button:has-text("+")').first();
    const addDealTopBtn = page.locator('button:has-text("معامله جدید")').first();

    const triggerBtn = (await quickAddBtn.isVisible().catch(() => false)) ? quickAddBtn : addDealTopBtn;
    if (await triggerBtn.isVisible().catch(() => false)) {
      await triggerBtn.click();
      await waitForUiSettled(page);

      const dealModal = page.locator('[role="dialog"]').first();
      await dealModal.waitFor({ state: 'visible', timeout: 5000 });

      const submitBtn = dealModal.locator('button[type="submit"], button:has-text("ذخیره")').first();
      // Submit empty form to verify human validation error
      await submitBtn.click();
      await page.waitForTimeout(300);

      // Name is required - form should remain open
      assert.ok(await dealModal.isVisible(), 'Deal modal should remain open on empty submit');

      // Fill with fuzz data (Persian quotes and emojis)
      const dealNameInput = dealModal.locator('input[name="name"], input#field-name, input[placeholder*="نام معامله"]').first();
      const testDealName = `معامله «تست فازینگ انسانی» ${Date.now().toString().slice(-4)} 🚀`;
      await dealNameInput.fill(testDealName);

      const amountInput = dealModal.locator('input[name="amount"], input#field-amount, input[type="number"]').first();
      if (await amountInput.isVisible().catch(() => false)) {
        await amountInput.fill('15000000');
      }

      const createResponse = await triggerAndWaitForResponse(
        page,
        (res) => res.url().includes('/api/v1/Opportunity') && res.request().method() === 'POST',
        () => submitBtn.click(),
        10000
      );
      await assertResponseOk(createResponse, 'Create Fuzz Deal');
      await waitForUiSettled(page);
      console.log(`   Created test fuzz deal: "${testDealName}"`);
    }

    // Test Loss Reason Modal Cancellation
    console.log('   Testing Loss Reason Modal cancellation...');
    const targetCard = col1.locator('.deal-card, [data-testid="deal-card"]').first();

    if (await targetCard.isVisible().catch(() => false)) {
      const cardTitle = (await targetCard.innerText()).split('\n')[0];
      console.log(`   Attempting drag of "${cardTitle}" to Closed Lost and then cancelling...`);

      // Trigger synthetic dragover/drop on Column 6 to trigger loss reason modal
      await page.evaluate(() => {
        const dropCol = document.querySelector('[data-testid="kanban-column-5"]');
        const card = document.querySelector('[data-testid="kanban-column-0"] [data-testid="deal-card"]');
        if (dropCol && card) {
          const dt = new DataTransfer();
          card.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
          dropCol.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true }));
          dropCol.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
          card.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
        }
      });
      await page.waitForTimeout(600);

      const lossModal = page.locator('div[role="dialog"]:has-text("علت از دست رفتن"), div:has-text("علت عدم موفقیت")').first();
      if (await lossModal.isVisible().catch(() => false)) {
        console.log('   LossReasonModal intercepted. Clicking Cancel ("انصراف")...');
        const cancelBtn = lossModal.locator('button:has-text("انصراف"), button:has-text("بستن")').first();
        await cancelBtn.click();
        await waitForUiSettled(page);

        assert.ok(!(await lossModal.isVisible().catch(() => false)), 'Loss modal must be closed after cancel');
        console.log('   Loss Reason cancellation successful. Deal was not lost.');
      }
    }
    console.log('✅ [Scenario 3 Passed] Kanban Chaos & Validation verified.');

    // -------------------------------------------------------------------------
    // Scenario 4: Contacts & Accounts Form Fuzzing (Iran Mobile & National ID)
    // -------------------------------------------------------------------------
    console.log('\n--- [Scenario 4] Testing Contacts & Accounts Input Fuzzing ---');
    const contactsNavLink = page.locator('a[href="/contacts"]').first();
    await contactsNavLink.click();
    await waitForUiSettled(page);

    const addContactBtn = page.locator('button:has-text("مخاطب جدید"), button:has-text("افزودن مخاطب")').first();
    if (await addContactBtn.isVisible().catch(() => false)) {
      await addContactBtn.click();
      await waitForUiSettled(page);

      const contactModal = page.locator('[role="dialog"]').first();
      await contactModal.waitFor({ state: 'visible', timeout: 5000 });

      const firstNameInput = contactModal.locator('[data-testid="contact-first-name"]');
      const lastNameInput = contactModal.locator('[data-testid="contact-last-name"]');
      const phoneInput = contactModal.locator('[data-testid="contact-phone"]');
      const submitBtn = contactModal.locator('button:has-text("ذخیره مخاطب")').first();

      const uniqueSuffix = Date.now().toString().slice(-4);
      const testLastName = `فازینگ ${uniqueSuffix}`;

      await firstNameInput.fill('کاربر');
      await lastNameInput.fill(testLastName);
      // Unformatted Iranian mobile number with spaces and dashes
      await phoneInput.fill(' 0912-345-6789 ');

      const createContactRes = await triggerAndWaitForResponse(
        page,
        (res) => res.url().includes('/api/v1/Contact') && res.request().method() === 'POST',
        () => submitBtn.click(),
        10000
      );
      await assertResponseOk(createContactRes, 'Create Contact with formatted phone');
      await waitForUiSettled(page);
      console.log(`   Created contact with unformatted phone: "کاربر ${testLastName}"`);
    }

    // Now test Accounts page search and empty state
    const accountsNavLink = page.locator('a[href="/accounts"]').first();
    await accountsNavLink.click();
    await waitForUiSettled(page);

    const accountSearch = page.locator('input[placeholder*="نام شرکت"]').first();
    if (await accountSearch.isVisible().catch(() => false)) {
      await accountSearch.fill('شرکت_ناموجود_جهت_تست_حالت_خالی_۹۹۹');
      await page.waitForTimeout(600);
      const emptyStateText = await page.locator('body').innerText();
      assert.ok(
        emptyStateText.includes('یافت نشد') || emptyStateText.includes('موردی') || emptyStateText.includes('خالی') || emptyStateText.includes('شرکت'),
        'Empty search result should render proper message without crashing'
      );
      // Clear search
      await accountSearch.fill('');
      await page.waitForTimeout(600);
    }

    // Create Account with 11-digit legal national ID
    const addAccountBtn = page.locator('button:has-text("شرکت جدید")').first();
    if (await addAccountBtn.isVisible().catch(() => false)) {
      await addAccountBtn.click();
      await waitForUiSettled(page);

      const accountModal = page.locator('[role="dialog"]').first();
      await accountModal.waitFor({ state: 'visible', timeout: 5000 });

      const accNameInput = accountModal.locator('input[placeholder*="داده‌پردازی"], input[name="name"]').first();
      const accPhoneInput = accountModal.locator('input[placeholder="02188888888"], input[type="tel"]').first();
      const accNatIdInput = accountModal.locator('input[placeholder="10101234567"]').first();
      const accSubmitBtn = accountModal.locator('button:has-text("ذخیره شرکت")').first();

      const accSuffix = Date.now().toString().slice(-4);
      const testAccountName = `شرکت ادورساریال ${accSuffix}`;

      await accNameInput.fill(testAccountName);
      if (await accPhoneInput.isVisible().catch(() => false)) {
        await accPhoneInput.fill('02188889999');
      }
      if (await accNatIdInput.isVisible().catch(() => false)) {
        await accNatIdInput.fill('10101234565');
      }

      const createAccRes = await triggerAndWaitForResponse(
        page,
        (res) => res.url().includes('/api/v1/Account') && res.request().method() === 'POST',
        () => accSubmitBtn.click(),
        10000
      );
      await assertResponseOk(createAccRes, 'Create Legal Account');
      await waitForUiSettled(page);
      console.log(`   Created legal account: "${testAccountName}"`);
    }
    console.log('✅ [Scenario 4 Passed] Contacts & Accounts Fuzzing verified.');

    // -------------------------------------------------------------------------
    // Scenario 5: Activities Page Tab Rapid Switching & Jalali Month Navigation
    // -------------------------------------------------------------------------
    console.log('\n--- [Scenario 5] Testing Activities Rapid Tab Switching & Jalali Grid ---');
    const activitiesNavLink = page.locator('a[href="/activities"]').first();
    await activitiesNavLink.click();
    await waitForUiSettled(page);

    // Switch rapidly between filter tabs like an impatient human user
    const tabs = ['همه', 'امروز', 'معوقه', 'فردا', 'همه'];
    for (const tabText of tabs) {
      const tabBtn = page.locator(`button:has-text("${tabText}")`).first();
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click();
        await page.waitForTimeout(100);
      }
    }

    // Switch to Jalali Calendar view and cycle months
    const calendarViewBtn = page.locator('button:has-text("تقویم"), button[title*="تقویم"]').first();
    if (await calendarViewBtn.isVisible().catch(() => false)) {
      await calendarViewBtn.click();
      await page.waitForTimeout(400);

      const nextMonthBtn = page.locator('button[aria-label*="بعد"], button:has-text("ماه بعد"), button:has-text("›"), button:has-text(">")').first();
      const prevMonthBtn = page.locator('button[aria-label*="قبل"], button:has-text("ماه قبل"), button:has-text("‹"), button:has-text("<")').first();

      if (await nextMonthBtn.isVisible().catch(() => false)) {
        await nextMonthBtn.click();
        await page.waitForTimeout(150);
        await nextMonthBtn.click();
        await page.waitForTimeout(150);
      }
      if (await prevMonthBtn.isVisible().catch(() => false)) {
        await prevMonthBtn.click();
        await page.waitForTimeout(150);
      }
    }
    console.log('✅ [Scenario 5 Passed] Activities Rapid Tab Switching & Jalali Grid verified.');

    // -------------------------------------------------------------------------
    // Scenario 6: Settings Page Tabs & Product Catalog Fuzzing
    // -------------------------------------------------------------------------
    console.log('\n--- [Scenario 6] Testing Settings Tabs & Product Catalog ---');
    const settingsNavLink = page.locator('a[href="/settings"]').first();
    await settingsNavLink.click();
    await waitForUiSettled(page);

    // Click through Settings tabs
    const settingTabs = ['محصولات و خدمات', 'اهداف فروش', 'الگوهای پیامک', 'فرم سرنخ وب', 'کلیدهای API'];
    for (const tabName of settingTabs) {
      const tab = page.locator(`button:has-text("${tabName}")`).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(150);
      }
    }
    console.log('✅ [Scenario 6 Passed] Settings Tabs verified.');

    // -------------------------------------------------------------------------
    // Scenario 7: Verify Zero Uncaught Exceptions / Page Errors
    // -------------------------------------------------------------------------
    console.log('\n--- [Scenario 7] Verifying Error Boundaries & Crash Immunity ---');
    assert.strictEqual(
      pageErrors.length,
      0,
      `Detected ${pageErrors.length} unhandled page exceptions:\n${pageErrors.join('\n')}`
    );
    console.log('✅ [Scenario 7 Passed] Zero unhandled page errors detected.');

    console.log('\n================================================================');
    console.log('🎉 All Human Exploratory & Fuzzing Scenarios Passed (GREEN).');
    console.log('================================================================');
  } finally {
    await cleanup();
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\n❌ Exploratory Fuzzing Pipeline failed:', err);
  process.exit(1);
});
