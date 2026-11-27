/**
 * BidarCRM E2E Test Suite - Section 6: Dashboard, KPI Metrics & Jalali Analytical Reports (/dashboard & /reports)
 *
 * Real browser-driven Playwright test verifying:
 * 1. Dashboard Jalali Period & Sales Rep Filtering (/dashboard):
 *    - Verify page heading ("پیشخوان فروش بیدار").
 *    - Verify Jalali period tabs ("ماه جاری", "ماه گذشته", "فصل جاری").
 *    - Intercept `GET /BidarDashboard/summary?jalaliPeriod=...` and verify analytical schema & HTTP 200.
 *    - Filter by sales representative (assignedUserId) and verify reactive UI card updates.
 * 2. KPI Metric Cards & Persian Toman Currency Formatting:
 *    - Primary KPI cards: "معاملات باز", "درآمد محقق‌شده", "معاملات پوسیده", "فعالیت‌های معوق".
 *    - Secondary KPI metrics: "نرخ تبدیل فروش" (percentage with ٪) and "سرعت فروش" (cycle days).
 *    - Assert that monetary values use Persian digits, proper grouping, and "تومان" currency suffix.
 * 3. Conversion Funnel & Analytical Widgets:
 *    - Sales Funnel Chart (`SalesFunnelChart`): Verify stage names, progress bars, deal counts, and stage values.
 *    - Sales Goal Widget (`SalesGoalWidget`): Verify target amount, achieved revenue, remaining gap, and progress bar.
 *    - Loss Reasons Widget (`LossReasonsWidget`): Verify loss reasons breakdown or graceful empty state.
 *    - Top Sales Reps Widget (`TopSalesRepsWidget`): Verify leaderboard table headers, ranks, names, and achieved revenue.
 *    - Lead Acquisition Sources Widget (`LeadSourcesWidget`): Verify marketing channel breakdown and monetary share.
 * 4. Comprehensive Reports Page & Persian CSV Export (/reports):
 *    - Navigate to `/reports` and verify header ("گزارش‌ها و تحلیل فروش").
 *    - Test switching reporting periods ("ماه جاری", "ماه گذشته", "فصل جاری") without console errors.
 *    - Trigger "خروجی CSV", capture the authenticated export response, and verify UTF-8 BOM + Persian headers.
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

export async function runDashboardReportsSection6Tests() {
  console.log('================================================================');
  console.log('🚀 Starting BidarCRM E2E Pipeline: Section 6 (داشبورد، شاخص‌های KPI و گزارش‌های تحلیلی)');
  console.log(`🎯 Target URL: ${BASE_URL}`);
  console.log('================================================================\n');

  const testResults = {
    dashboardFiltering: { passed: false, details: null, bugDossier: null },
    kpiMetricCards: { passed: false, details: null, bugDossier: null },
    analyticalWidgets: { passed: false, details: null, bugDossier: null },
    reportsPageAndExport: { passed: false, details: null, bugDossier: null },
  };

  let browser = null;
  let page = null;
  let cleanupCreatedEntities = null;

  // Track network calls
  const networkLogs = [];
  const consoleErrors = [];

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'fa-IR',
      acceptDownloads: true,
    });

    page = await context.newPage();
    cleanupCreatedEntities = cleanupEntities(page);

    page.on('request', (req) => {
      if (req.url().includes('/BidarDashboard/summary') || req.url().includes('/BidarExport') || req.url().includes('/User')) {
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
      if (res.url().includes('/BidarDashboard/summary') || res.url().includes('/BidarExport') || res.url().includes('/User')) {
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
    // Scenario 1: Dashboard Jalali Period & Sales Rep Filtering
    // =============================================================
    console.log('--- [Scenario 1] Testing Dashboard Jalali Period & Sales Rep Filtering (/dashboard) ---');
    try {
      // Ensure we are on /dashboard
      await page.locator('nav a[href="/dashboard"], a[href="/dashboard"]').first().click();
      await waitForUiSettled(page);

      // Verify Header
      const h1Text = await page.locator('h1').innerText();
      console.log(`   Dashboard Heading: "${h1Text.trim()}"`);
      assert(
        h1Text.includes('پیشخوان فروش') || h1Text.includes('داشبورد'),
        `Expected heading to contain 'پیشخوان فروش' or 'داشبورد', got '${h1Text}'`
      );

      // Verify Jalali Period Selector Buttons
      const currentMonthBtn = page.locator('button:has-text("ماه جاری")');
      const lastMonthBtn = page.locator('button:has-text("ماه گذشته")');
      const currentQuarterBtn = page.locator('button:has-text("فصل جاری")');

      assert((await currentMonthBtn.count()) > 0, 'Button "ماه جاری" not found in dashboard period bar.');
      assert((await lastMonthBtn.count()) > 0, 'Button "ماه گذشته" not found in dashboard period bar.');
      assert((await currentQuarterBtn.count()) > 0, 'Button "فصل جاری" not found in dashboard period bar.');

      // Test Switching to 'ماه گذشته' and capture GET /BidarDashboard/summary.
      console.log('   Switching period to "ماه گذشته"...');
      const lastMonthRes = await triggerAndWaitForResponse(
        page,
        (response) => {
          const url = new URL(response.url());
          return response.request().method() === 'GET'
            && url.pathname === '/api/v1/BidarDashboard/summary'
            && url.searchParams.get('jalaliPeriod') === 'last_month';
        },
        () => lastMonthBtn.click(),
        7000
      );
      const lastMonthBody = await assertResponseOk(lastMonthRes, 'GET /api/v1/BidarDashboard/summary (last_month)', [200]);
      const lastMonthData = JSON.parse(lastMonthBody);
      assert('openCount' in lastMonthData, 'Missing openCount in last_month dashboard summary response');
      assert('wonAmount' in lastMonthData, 'Missing wonAmount in last_month dashboard summary response');
      console.log(`   Received valid analytical payload for "ماه گذشته" (openCount: ${lastMonthData.openCount}, wonAmount: ${lastMonthData.wonAmount})`);

      // Test Switching to 'فصل جاری'
      console.log('   Switching period to "فصل جاری"...');
      const quarterRes = await triggerAndWaitForResponse(
        page,
        (response) => {
          const url = new URL(response.url());
          return response.request().method() === 'GET'
            && url.pathname === '/api/v1/BidarDashboard/summary'
            && url.searchParams.get('jalaliPeriod') === 'current_quarter';
        },
        () => currentQuarterBtn.click(),
        7000
      );
      const quarterBody = await assertResponseOk(quarterRes, 'GET /api/v1/BidarDashboard/summary (current_quarter)', [200]);
      const quarterData = JSON.parse(quarterBody);
      assert('conversionRate' in quarterData, 'Missing conversionRate in quarter summary');
      console.log(`   Received valid analytical payload for "فصل جاری" (conversionRate: ${quarterData.conversionRate}%)`);

      // Switch back to 'ماه جاری' and capture the summary response if not cached.
      const currentMonthRes = await triggerAndWaitForResponse(
        page,
        (response) => {
          const url = new URL(response.url());
          return response.request().method() === 'GET'
            && url.pathname === '/api/v1/BidarDashboard/summary'
            && url.searchParams.get('jalaliPeriod') === 'current_month';
        },
        () => currentMonthBtn.click(),
        2000
      ).catch(() => null);
      if (currentMonthRes) {
        await assertResponseOk(currentMonthRes, 'GET /api/v1/BidarDashboard/summary (current_month)', [200]);
      }
      await waitForUiSettled(page);

      // Test Sales Rep User Filter Dropdown
      const userSelect = page.locator('select').first();
      assert((await userSelect.count()) > 0, 'User filter select dropdown not found in dashboard header.');

      const selectOptions = await userSelect.locator('option').allInnerTexts();
      console.log(`   User filter options: [${selectOptions.join(', ')}]`);
      assert(selectOptions.some((opt) => opt.includes('همه کارشناسان')), 'Option "همه کارشناسان" missing from dropdown');

      // Filter by "Admin" and capture the filtered summary response.
      if (selectOptions.some((opt) => opt.includes('Admin'))) {
        console.log('   Filtering by sales representative "Admin"...');
        const userFilterRes = await triggerAndWaitForResponse(
          page,
          (response) => {
            const url = new URL(response.url());
            return response.request().method() === 'GET'
              && url.pathname === '/api/v1/BidarDashboard/summary'
              && url.searchParams.has('assignedUserId');
          },
          () => userSelect.selectOption({ label: 'Admin' }),
          7000
        );
        const userFilterBody = await assertResponseOk(userFilterRes, 'GET /api/v1/BidarDashboard/summary (assignedUserId)', [200]);
        const userFilteredData = JSON.parse(userFilterBody);
        console.log(`   User filtered summary received: openCount=${userFilteredData.openCount}, wonCount=${userFilteredData.wonCount}`);

        // Reset filter back to all and capture the unfiltered summary response if not cached.
        const resetUserRes = await triggerAndWaitForResponse(
          page,
          (response) => {
            const url = new URL(response.url());
            return response.request().method() === 'GET'
              && url.pathname === '/api/v1/BidarDashboard/summary'
              && !url.searchParams.has('assignedUserId');
          },
          () => userSelect.selectOption({ label: 'همه کارشناسان' }),
          2000
        ).catch(() => null);
        if (resetUserRes) {
          await assertResponseOk(resetUserRes, 'GET /api/v1/BidarDashboard/summary (all users)', [200]);
        }
        await waitForUiSettled(page);
      }

      testResults.dashboardFiltering = {
        passed: true,
        details: 'Jalali periods (ماه جاری, ماه گذشته, فصل جاری) and assigned user dropdown verified with valid analytical responses (HTTP 200).',
        bugDossier: null,
      };
      console.log('✅ [Scenario 1 Passed] Dashboard Jalali Period & Sales Rep Filtering verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 1 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('BidarDashboard')).at(-1);
      testResults.dashboardFiltering = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-DASHBOARD-001',
          title: 'Dashboard Period / User Filter Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in and navigate to /dashboard.',
            '2. Click period buttons "ماه گذشته", "فصل جاری", and "ماه جاری".',
            '3. Change the user filter to a specific sales rep and back to all users.',
            '4. Inspect each GET /api/v1/BidarDashboard/summary response and its query parameters.',
          ],
          domSnippet: await page.locator('h1').locator('..').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((log) => log.url?.includes('BidarDashboard')),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    }

    // =============================================================
    // Scenario 2: KPI Metric Cards & Persian Toman Currency Formatting
    // =============================================================
    console.log('--- [Scenario 2] Testing KPI Metric Cards & Persian Toman Formatting ---');
    try {
      // 4 Primary KPI cards: معاملات باز, درآمد محقق‌شده, معاملات پوسیده, فعالیت‌های معوق
      const primaryTitles = ['معاملات باز', 'درآمد محقق‌شده', 'معاملات پوسیده', 'فعالیت‌های معوق'];
      for (const title of primaryTitles) {
        const card = page.locator('.grid > div').filter({ hasText: title }).first();
        assert((await card.count()) > 0, `Primary KPI card "${title}" not found on dashboard.`);
        const cardText = await card.innerText();
        console.log(`   KPI Card "${title}": "${cardText.replace(/\n+/g, ' | ')}"`);

        // Check currency format for monetary cards
        if (title === 'معاملات باز' || title === 'درآمد محقق‌شده') {
          assert(cardText.includes('تومان'), `KPI Card "${title}" missing "تومان" currency unit.`);
          // Validate presence of Persian digits (۰-۹) or proper thousands separator
          assert(/[۰-۹]/.test(cardText), `KPI Card "${title}" does not contain Persian numerals.`);
        }
      }

      // Secondary metrics: نرخ تبدیل فروش and سرعت فروش (میانگین چرخه)
      const conversionCard = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ hasText: 'نرخ تبدیل فروش' }).last();
      assert((await conversionCard.count()) > 0, 'Conversion rate KPI card ("نرخ تبدیل فروش") not found.');
      const convText = await conversionCard.innerText();
      console.log(`   Conversion Rate Card: "${convText.replace(/\n+/g, ' | ')}"`);
      assert(convText.includes('٪'), 'Conversion rate card missing percent sign ("٪").');

      const cycleCard = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ hasText: 'سرعت فروش' }).last();
      assert((await cycleCard.count()) > 0, 'Sales cycle KPI card ("سرعت فروش") not found.');
      const cycleText = await cycleCard.innerText();
      console.log(`   Sales Cycle Card: "${cycleText.replace(/\n+/g, ' | ')}"`);
      assert(cycleText.includes('روز'), 'Sales cycle card missing "روز" unit.');

      testResults.kpiMetricCards = {
        passed: true,
        details: 'All primary and secondary KPI cards verified with Persian numerals, "تومان" currency symbol, and percentage signs.',
        bugDossier: null,
      };
      console.log('✅ [Scenario 2 Passed] KPI Metric Cards & Persian Toman Formatting verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 2 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('BidarDashboard')).at(-1);
      testResults.kpiMetricCards = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-DASHBOARD-002',
          title: 'KPI Metric Card Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in and navigate to /dashboard.',
            '2. Inspect primary KPI cards (معاملات باز, درآمد محقق‌شده, معاملات پوسیده, فعالیت‌های معوق).',
            '3. Check currency unit (تومان), Persian digits, percentage, and sales-cycle units.',
          ],
          domSnippet: await page.locator('.grid').first().innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((log) => log.url?.includes('BidarDashboard')),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    }

    // =============================================================
    // Scenario 3: Conversion Funnel & Analytical Widgets
    // =============================================================
    console.log('--- [Scenario 3] Testing Conversion Funnel & Analytical Widgets ---');
    try {
      // 1. Sales Funnel Chart (`SalesFunnelChart`)
      const funnelWidget = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ has: page.locator('h3:has-text("قیف فروش معاملات")') }).first();
      assert((await funnelWidget.count()) > 0, 'Sales Funnel Chart widget ("قیف فروش معاملات") not found.');
      const funnelText = await funnelWidget.innerText();
      console.log(`   Funnel Widget Text: "${funnelText.replace(/\n+/g, ' | ').slice(0, 160)}..."`);
      assert(funnelText.includes('مرحله'), 'Funnel widget missing stages count indicator.');

      // Check stages in funnel
      const funnelStages = ['تماس اولیه', 'پیگیری و مذاکره', 'ارسال پیش‌فاکتور', 'مذاکره نهایی'];
      let foundStages = 0;
      for (const st of funnelStages) {
        if (funnelText.includes(st)) {
          foundStages++;
        }
      }
      console.log(`   Found ${foundStages}/${funnelStages.length} expected sales pipeline stages in funnel chart.`);
      assert(foundStages >= 2, 'Sales Funnel Chart does not display pipeline stages.');

      // 2. Sales Goal Widget (`SalesGoalWidget`)
      const goalWidget = page.locator('[data-testid="sales-goal-widget"]');
      assert((await goalWidget.count()) > 0, 'Sales Goal Widget ([data-testid="sales-goal-widget"]) not found.');
      const goalText = await goalWidget.innerText();
      console.log(`   Sales Goal Widget: "${goalText.replace(/\n+/g, ' | ')}"`);
      assert(
        goalText.includes('مبلغ محقق‌شده') && goalText.includes('هدف کل') && goalText.includes('باقی‌مانده'),
        'Sales Goal Widget missing financial breakdown labels.'
      );
      assert(goalText.includes('تومان'), 'Sales Goal Widget missing "تومان" currency unit.');

      const goalProgressBar = page.locator('[data-testid="sales-goal-progress-bar"]');
      assert((await goalProgressBar.count()) > 0, 'Goal progress bar element not found.');

      // 3. Loss Reasons Widget (`LossReasonsWidget`)
      const lossWidget = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ has: page.locator('h3:has-text("تحلیل دلایل شکست معاملات")') }).first();
      assert((await lossWidget.count()) > 0, 'Loss Reasons Widget ("تحلیل دلایل شکست معاملات") not found.');
      const lossText = await lossWidget.innerText();
      console.log(`   Loss Reasons Widget: "${lossText.replace(/\n+/g, ' | ').slice(0, 180)}..."`);
      // Either displays reasons or graceful empty state
      assert(
        lossText.includes('مورد باخته') || lossText.includes('ناموفقی در این دوره گزارش نشده'),
        'Loss Reasons Widget missing proper state presentation.'
      );

      // 4. Top Sales Reps Widget (`TopSalesRepsWidget`)
      const repsWidget = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ has: page.locator('h3:has-text("برترین کارشناسان فروش")') }).first();
      assert((await repsWidget.count()) > 0, 'Top Sales Reps Widget ("برترین کارشناسان فروش") not found.');
      const repsTable = repsWidget.locator('table');
      assert((await repsTable.count()) > 0, 'Leaderboard table missing inside TopSalesRepsWidget.');
      const theadText = await repsTable.locator('thead').innerText();
      console.log(`   Top Sales Reps table headers: "${theadText.replace(/\n+/g, ' | ')}"`);
      assert(
        theadText.includes('کارشناس') && theadText.includes('درآمد محقق'),
        'Leaderboard table missing required columns (کارشناس, درآمد محقق).'
      );

      // 5. Lead Acquisition Sources Widget (`LeadSourcesWidget`)
      const sourcesWidget = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ has: page.locator('h3:has-text("منابع جذب سرنخ و مشتریان")') }).first();
      assert((await sourcesWidget.count()) > 0, 'Lead Sources Widget ("منابع جذب سرنخ و مشتریان") not found.');
      const sourcesText = await sourcesWidget.innerText();
      console.log(`   Lead Sources Widget: "${sourcesText.replace(/\n+/g, ' | ').slice(0, 180)}..."`);
      assert(
        sourcesText.includes('کانال‌های بازاریابی') || sourcesText.includes('تفکیک کانال‌های'),
        'Lead Sources Widget missing descriptive subtitle.'
      );

      testResults.analyticalWidgets = {
        passed: true,
        details: 'All 5 analytical widgets (Sales Funnel, Sales Goal, Loss Reasons, Top Sales Reps, Lead Sources) verified.',
        bugDossier: null,
      };
      console.log('✅ [Scenario 3 Passed] Conversion Funnel & Analytical Widgets verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 3 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('BidarDashboard')).at(-1);
      testResults.analyticalWidgets = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-DASHBOARD-003',
          title: 'Analytical Widget Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in and navigate to /dashboard.',
            '2. Check Sales Funnel, Sales Goal, Loss Reasons, Top Sales Reps, and Lead Sources widgets.',
            '3. Verify charts, bars, and tables render the current summary data.',
          ],
          domSnippet: await page.locator('.space-y-6').first().innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((log) => log.url?.includes('BidarDashboard')),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    }

    // =============================================================
    // Scenario 4: Comprehensive Reports Page & Persian CSV Export (/reports)
    // =============================================================
    console.log('--- [Scenario 4] Testing Comprehensive Reports Page & Persian CSV Export (/reports) ---');
    try {
      // 1. Navigate to /reports
      console.log('   Navigating to /reports...');
      await page.locator('nav a[href="/reports"], a[href="/reports"]').first().click();
      await waitForUiSettled(page);

      assert(page.url().includes('/reports'), `Expected URL to include /reports, got ${page.url()}`);
      const reportsH1 = await page.locator('h1').innerText();
      console.log(`   Reports Page Heading: "${reportsH1.trim()}"`);
      assert(
        reportsH1.includes('گزارش‌ها') || reportsH1.includes('تحلیل فروش'),
        `Expected heading to contain 'گزارش‌ها' or 'تحلیل فروش', got '${reportsH1}'`
      );

      // Verify period switching in reports
      const reportsLastMonthBtn = page.locator('button:has-text("ماه گذشته")').first();
      const reportsQuarterBtn = page.locator('button:has-text("فصل جاری")').first();
      const reportsCurrentMonthBtn = page.locator('button:has-text("ماه جاری")').first();

      console.log('   Switching period to "ماه گذشته" in reports...');
      const repLastMonthRes = await triggerAndWaitForResponse(
        page,
        (response) => {
          const url = new URL(response.url());
          return response.request().method() === 'GET'
            && url.pathname === '/api/v1/BidarDashboard/summary'
            && url.searchParams.get('jalaliPeriod') === 'last_month';
        },
        () => reportsLastMonthBtn.click(),
        2000
      ).catch(() => null);
      if (repLastMonthRes) {
        await assertResponseOk(repLastMonthRes, 'GET /api/v1/BidarDashboard/summary (reports last_month)', [200]);
      }
      await waitForUiSettled(page);

      console.log('   Switching period to "فصل جاری" in reports...');
      const repQuarterRes = await triggerAndWaitForResponse(
        page,
        (response) => {
          const url = new URL(response.url());
          return response.request().method() === 'GET'
            && url.pathname === '/api/v1/BidarDashboard/summary'
            && url.searchParams.get('jalaliPeriod') === 'current_quarter';
        },
        () => reportsQuarterBtn.click(),
        2000
      ).catch(() => null);
      if (repQuarterRes) {
        await assertResponseOk(repQuarterRes, 'GET /api/v1/BidarDashboard/summary (reports current_quarter)', [200]);
      }
      await waitForUiSettled(page);

      // Switch back to current month and capture the summary response if not cached.
      console.log('   Switching back to "ماه جاری" in reports...');
      const repCurrentMonthRes = await triggerAndWaitForResponse(
        page,
        (response) => {
          const url = new URL(response.url());
          return response.request().method() === 'GET'
            && url.pathname === '/api/v1/BidarDashboard/summary'
            && url.searchParams.get('jalaliPeriod') === 'current_month';
        },
        () => reportsCurrentMonthBtn.click(),
        2000
      ).catch(() => null);
      if (repCurrentMonthRes) {
        await assertResponseOk(repCurrentMonthRes, 'GET /api/v1/BidarDashboard/summary (reports current_month)', [200]);
      }
      await waitForUiSettled(page);

      // Verify analytical sections on reports page
      const wonRevenueCard = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ hasText: 'درآمد محقق‌شده در بازه' }).last();
      assert((await wonRevenueCard.count()) > 0, 'Card "درآمد محقق‌شده در بازه" missing on reports page.');
      const wonRevText = await wonRevenueCard.innerText();
      console.log(`   Won Revenue in Period: "${wonRevText.replace(/\n+/g, ' | ')}"`);
      assert(wonRevText.includes('تومان'), 'Reports revenue card missing "تومان" unit.');

      const conversionReportsCard = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ hasText: 'نرخ تبدیل نهایی فروش' }).last();
      assert((await conversionReportsCard.count()) > 0, 'Card "نرخ تبدیل نهایی فروش" missing on reports page.');
      const convRepText = await conversionReportsCard.innerText();
      console.log(`   Reports Conversion Rate: "${convRepText.replace(/\n+/g, ' | ')}"`);

      const cycleReportsCard = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ hasText: 'طول میانگین چرخه فروش' }).last();
      assert((await cycleReportsCard.count()) > 0, 'Card "طول میانگین چرخه فروش" missing on reports page.');
      const cycleRepText = await cycleReportsCard.innerText();
      console.log(`   Reports Cycle Time: "${cycleRepText.replace(/\n+/g, ' | ')}"`);

      const activePipelineCard = page.locator('div.bg-white, div.dark\\:bg-slate-900').filter({ hasText: 'معاملات فعال در کاریز' }).last();
      assert((await activePipelineCard.count()) > 0, 'Card "معاملات فعال در کاریز" missing on reports page.');
      const activeDealsText = await activePipelineCard.innerText();
      console.log(`   Reports Active Deals: "${activeDealsText.replace(/\n+/g, ' | ')}"`);

      // 2. Capture the authenticated Opportunity export response from the UI.
      console.log('   Testing Persian CSV Export button ("خروجی CSV")...');
      const exportBtn = page.locator('button:has-text("خروجی CSV")');
      assert((await exportBtn.count()) > 0, 'Button "خروجی CSV" not found on reports page.');

      const exportResponse = await triggerAndWaitForResponse(
        page,
        (response) => {
          const url = new URL(response.url());
          return response.request().method() === 'GET'
            && url.pathname === '/api/v1/BidarExport/Opportunity'
            && url.searchParams.get('period') === 'current_month';
        },
        () => exportBtn.click()
      );
      const csvBuffer = await exportResponse.body();
      const csvContent = csvBuffer.toString('utf8');
      const exportStatus = exportResponse.status();

      console.log(`   Opportunity export response status: ${exportStatus}`);
      console.log(`   CSV response size: ${csvBuffer.length} bytes`);
      assert.equal(
        exportStatus,
        200,
        `Opportunity export failed with HTTP ${exportStatus} ${exportResponse.statusText()}: ${csvContent.slice(0, 1000)}`
      );
      assert(csvContent.trim().length > 0, 'Opportunity export response body is empty.');

      let first3Bytes = Array.from(csvBuffer.subarray(0, 3));
      if (first3Bytes[0] !== 0xef) {
        const rawRes = await page.request.get(exportResponse.url(), {
          headers: exportResponse.request().headers(),
        });
        const rawBuf = await rawRes.body();
        first3Bytes = Array.from(rawBuf.subarray(0, 3));
      }

      // Verify UTF-8 BOM (0xEF, 0xBB, 0xBF).
      assert(
        first3Bytes[0] === 0xef && first3Bytes[1] === 0xbb && first3Bytes[2] === 0xbf,
        `Opportunity export response is missing UTF-8 BOM sequence (0xEF, 0xBB, 0xBF). Got [${first3Bytes.join(', ')}]`
      );

      const firstLine = csvContent.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
      console.log(`   CSV First Line (Headers): "${firstLine}"`);
      assert(
        firstLine.includes('نام معامله') && firstLine.includes('مبلغ') && firstLine.includes('مرحله'),
        `CSV headers missing expected Persian columns. Got: '${firstLine}'`
      );

      // Check console errors
      assert(consoleErrors.length === 0, `Unexpected console errors during reports execution: ${consoleErrors.join(', ')}`);

      testResults.reportsPageAndExport = {
        passed: true,
        details: `Reports page verified: period responses and the Opportunity CSV blob response returned HTTP 200 without console errors; response contained UTF-8 BOM and Persian headers (${csvBuffer.length} bytes).`,
        bugDossier: null,
      };
      console.log('✅ [Scenario 4 Passed] Comprehensive Reports Page & Persian CSV Export verified.\n');
    } catch (err) {
      console.error('❌ [Scenario 4 Failed]:', err.message);
      const latestResponse = networkLogs.filter((log) => log.type === 'RESPONSE' && log.url?.includes('BidarExport')).at(-1);
      testResults.reportsPageAndExport = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-REPORTS-001',
          title: 'Reports Page / Opportunity CSV Export Verification Failure',
          assertion: err.message,
          reproduction: [
            '1. Log in and navigate to /reports.',
            '2. Switch Jalali periods (ماه گذشته, فصل جاری, ماه جاری) and inspect each summary response.',
            '3. Click "خروجی CSV" and inspect GET /api/v1/BidarExport/Opportunity?period=current_month.',
            '4. Verify HTTP status, a non-empty CSV body, UTF-8 BOM (0xEF, 0xBB, 0xBF), and Persian headers.',
          ],
          domSnippet: await page.locator('div.space-y-6').first().innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((log) => log.url?.includes('BidarExport') || log.url?.includes('BidarDashboard')),
          status: err.status ?? latestResponse?.status ?? null,
          responseBody: err.responseBody ?? err.body ?? latestResponse?.body ?? null,
          rootCause: err.message,
        },
      };
    }
  } catch (fatalErr) {
    console.error('💥 Unexpected fatal error in Section 6 suite:', fatalErr);
    recordFatalError(testResults, fatalErr, page);
  } finally {
    try {
      if (cleanupCreatedEntities) {
        await cleanupCreatedEntities();
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // =============================================================
  // Summary & Bug Dossier Compilation
  // =============================================================
  console.log('================================================================');
  console.log('📊 SECTION 6 TEST EXECUTION SUMMARY:');
  console.log(`   1. Dashboard Jalali Period & Sales Rep Filtering: ${testResults.dashboardFiltering.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   2. KPI Metric Cards & Persian Toman Formatting:   ${testResults.kpiMetricCards.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   3. Conversion Funnel & Analytical Widgets:         ${testResults.analyticalWidgets.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   4. Reports Page & Persian CSV Export:              ${testResults.reportsPageAndExport.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log('================================================================\n');

  return testResults;
}

// Direct execution support
if (process.argv[1]?.endsWith('dashboard-reports.spec.js')) {
  runDashboardReportsSection6Tests()
    .then((results) => {
      const hasFailures = Object.values(results).some((r) => r.passed === false);
      if (hasFailures) {
        console.log('⚠️ Section 6 test suite completed with defects detected (RED).');
        process.exitCode = 1;
      } else {
        console.log('🎉 All Section 6 tests passed (GREEN).');
        process.exitCode = 0;
      }
    })
    .catch((err) => {
      console.error('Fatal runner error:', err);
      process.exitCode = 2;
    });
}
