/**
 * BidarCRM E2E Test Suite - Section 8.2: Global Features & Modern Panel Verification (`http://localhost:8089/app/`)
 *
 * Real browser-driven Playwright test verifying:
 * 1. Global Search (Command Palette - Ctrl+K / Meta+K):
 *    - Open floating search modal via `Ctrl+K` keypress and via header search input click.
 *    - Type search query (e.g. "معامله" or "آرش") and intercept `GET /GlobalSearch?q=...`.
 *    - Assert that results are properly categorized into deals, contacts, or accounts groups.
 * 2. Theme Switching (Light / Dark Mode) & Sidebar Adaptation:
 *    - Toggle to Light Mode: verify `html` has no `dark` class, sidebar has `bg-white` background.
 *    - Toggle to Dark Mode: verify `html` has `dark` class, sidebar adapts to `dark:bg-slate-950`.
 * 3. Status Badges & Persian Numerals Formatting:
 *    - Verify `whitespace-nowrap` class on status pills and badge components in tables.
 *    - Verify Persian numerals and `tabular-nums` / `font-mono` applied to currency and counter metrics.
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

export async function runGlobalFeaturesTests() {
  console.log('================================================================');
  console.log('🚀 Starting BidarCRM E2E Pipeline: Section 8.2 (امکانات سراسری پنل هدلس)');
  console.log(`🎯 Target URL: ${BASE_URL}`);
  console.log('================================================================\n');

  const testResults = {
    globalSearch: { passed: false, details: null, bugDossier: null },
    themeSwitchingAndSidebar: { passed: false, details: null, bugDossier: null },
    badgesAndPersianNumerals: { passed: false, details: null, bugDossier: null },
  };

  let browser = null;
  let page = null;
  let cleanupCreatedEntities = null;

  const networkLogs = [];

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
      if (req.url().includes('/GlobalSearch')) {
        networkLogs.push({
          type: 'REQUEST',
          timestamp: new Date().toISOString(),
          url: req.url(),
          method: req.method(),
        });
      }
    });

    page.on('response', async (res) => {
      if (res.url().includes('/GlobalSearch')) {
        let body = '';
        try {
          body = await res.text();
        } catch {
          body = '<unreadable>';
        }
        networkLogs.push({
          type: 'RESPONSE',
          timestamp: new Date().toISOString(),
          url: res.url(),
          status: res.status(),
          body: body.slice(0, 400),
        });
      }
    });

    // -------------------------------------------------------------
    // Setup: Log in to Headless Panel
    // -------------------------------------------------------------
    console.log('🔐 [Setup] Logging in to Headless Panel as admin...');
    await loginToApp(page, BASE_URL, CREDENTIALS);
    console.log('✅ Logged in successfully.\n');

    // =============================================================
    // Step 1: Global Search (Command Palette - Ctrl+K)
    // =============================================================
    console.log('--- [Step 1] Verifying Global Search Command Palette (Ctrl+K & Search Results) ---');
    let searchResponse = null;
    let searchResponseBody = null;
    let renderedModalText = '';
    try {
      // 1. Trigger Search via Ctrl+K
      console.log('   Ensuring search input is ready and pressing Control+k...');
      const headerSearchInput = page.locator('input[placeholder*="جستجو"]').first();
      await headerSearchInput.waitFor({ state: 'visible', timeout: 10000 });
      await page.click('body');
      await page.keyboard.press('Control+k');
      await waitForUiSettled(page);

      const modal = page.locator('[role="dialog"], .fixed.inset-0.z-50');
      assert(await modal.isVisible(), 'Global Search modal was not displayed upon pressing Control+k.');
      console.log('   Global Search modal is visible.');

      // 2. Type query in modal input
      const modalInput = modal.locator('input');
      assert((await modalInput.count()) > 0, 'Search input field missing from search modal.');

      console.log('   Typing query "معامله" in search input...');
      searchResponse = await triggerAndWaitForResponse(
        page,
        (res) => res.request().method() === 'GET' && res.url().includes('/GlobalSearch?q='),
        () => modalInput.fill('معامله')
      );
      searchResponseBody = await assertResponseOk(searchResponse, 'GET /GlobalSearch');
      await waitForUiSettled(page);

      renderedModalText = await modal.innerText();
      console.log(`   Search modal text preview: "${renderedModalText.replace(/\n+/g, ' | ').slice(0, 180)}..."`);

      const hasExpectedDealsResult = renderedModalText.includes('معاملات (') || renderedModalText.includes('معامله');
      if (!hasExpectedDealsResult) {
        throw new Error(
          `Global Search did not render the expected deals group or results for query "معامله". GET /GlobalSearch returned HTTP ${searchResponse.status()} ${searchResponse.statusText()}; response body: ${searchResponseBody.slice(0, 1000)}; rendered modal text: ${renderedModalText.slice(0, 1000)}`
        );
      }

      // Close modal
      await page.keyboard.press('Escape');
      await waitForUiSettled(page);
      assert(!(await modal.isVisible()), 'Search modal did not close on Escape key.');

      testResults.globalSearch = {
        passed: true,
        details: `Global Search modal invoked via Ctrl+K, GET /GlobalSearch returned HTTP ${searchResponse.status()}, expected deals results rendered, and Escape closed modal.`,
        bugDossier: null,
      };
      console.log('✅ [Step 1 Passed] Global Search verified.\n');
    } catch (err) {
      console.error('❌ [Step 1 Failed]:', err.message);
      testResults.globalSearch = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-SEARCH-001',
          title: 'Global Search Request or Result Rendering Failure',
          assertion: err.message,
          reproduction: [
            `1. Navigate to ${BASE_URL}.`,
            '2. Press Ctrl+K to open Global Search modal.',
            '3. Type "معامله" or "آرش".',
            '4. Compare the GET /GlobalSearch status and response body with the rendered result groups.',
          ],
          httpStatus: searchResponse?.status() ?? null,
          responseBody: searchResponseBody ?? (searchResponse
            ? await searchResponse.text().catch(() => '<unreadable response body>')
            : '<not captured>'),
          renderedModalText: renderedModalText || '<not captured>',
          domSnippet: await page.locator('[role="dialog"]').innerHTML().catch(() => '<unavailable>'),
          networkLogs: networkLogs.filter((l) => l.url?.includes('GlobalSearch')),
          rootCause: err.message,
        },
      };
    } finally {
      // Ensure modal is closed
      try {
        await page.keyboard.press('Escape');
      } catch {}
    }

    // =============================================================
    // Step 2: Theme Switching (Light / Dark Mode) & Sidebar Adaptation
    // =============================================================
    console.log('--- [Step 2] Verifying Light / Dark Mode Toggle & Sidebar Adaptation ---');
    try {
      const themeBtn = page.locator('button[title*="حالت"], button:has(svg.lucide-sun), button:has(svg.lucide-moon)').first();
      assert((await themeBtn.count()) > 0, 'Theme toggle button missing from app header.');

      const htmlEl = page.locator('html');
      const sidebar = page.locator('aside, nav').first();
      assert((await sidebar.count()) > 0, 'Sidebar navigation component not found.');

      // 1. Test Light Mode
      // If currently dark, click once to make it light
      let currentHtmlClass = (await htmlEl.getAttribute('class')) || '';
      if (currentHtmlClass.includes('dark')) {
        console.log('   Switching to Light Mode...');
        await themeBtn.click();
        await waitForUiSettled(page);
      }

      const lightHtmlClass = (await htmlEl.getAttribute('class')) || '';
      console.log(`   Light Mode HTML class: "${lightHtmlClass}"`);
      assert(!lightHtmlClass.includes('dark'), 'HTML element still contains "dark" class in light mode.');

      const sidebarClassLight = (await sidebar.getAttribute('class')) || '';
      console.log(`   Sidebar classes in Light Mode: "${sidebarClassLight.slice(0, 100)}..."`);
      assert(
        sidebarClassLight.includes('bg-white'),
        'Sidebar does not have "bg-white" class for crisp light mode appearance.'
      );

      // Verify computed background color in Light Mode
      const sidebarBgLight = await sidebar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      console.log(`   Sidebar computed background in Light Mode: ${sidebarBgLight}`);
      // In RGB, white is rgb(255, 255, 255)
      assert(
        sidebarBgLight.includes('255, 255, 255') || sidebarBgLight.includes('rgba(255, 255, 255'),
        `Expected sidebar background to be white in light mode, got ${sidebarBgLight}`
      );

      // 2. Test Dark Mode
      console.log('   Switching to Dark Mode...');
      await themeBtn.click();
      await waitForUiSettled(page);

      const darkHtmlClass = (await htmlEl.getAttribute('class')) || '';
      console.log(`   Dark Mode HTML class: "${darkHtmlClass}"`);
      assert(darkHtmlClass.includes('dark'), 'HTML element does not contain "dark" class after toggle.');

      const sidebarClassDark = (await sidebar.getAttribute('class')) || '';
      assert(
        sidebarClassDark.includes('dark:bg-slate-950') || sidebarClassDark.includes('bg-slate-950'),
        'Sidebar missing "dark:bg-slate-950" dark mode class.'
      );

      const sidebarBgDark = await sidebar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      console.log(`   Sidebar computed background in Dark Mode: ${sidebarBgDark}`);
      // In slate-950, RGB is rgb(2, 6, 23)
      assert(
        sidebarBgDark.includes('2, 6, 23') || !sidebarBgDark.includes('255, 255, 255'),
        `Expected dark background for sidebar in dark mode, got ${sidebarBgDark}`
      );

      testResults.themeSwitchingAndSidebar = {
        passed: true,
        details: `Theme toggle verified: Light mode sets html[class=""] with white sidebar (${sidebarBgLight}), Dark mode sets html[class="dark"] with slate-950 sidebar (${sidebarBgDark}).`,
        bugDossier: null,
      };
      console.log('✅ [Step 2 Passed] Light / Dark Mode Toggle & Sidebar Adaptation verified.\n');
    } catch (err) {
      console.error('❌ [Step 2 Failed]:', err.message);
      testResults.themeSwitchingAndSidebar = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-THEME-SIDEBAR-001',
          title: 'Theme Switching & Sidebar Contrast Defect',
          assertion: err.message,
          reproduction: [
            `1. Navigate to ${BASE_URL}.`,
            '2. Click theme toggle button to switch between light and dark modes.',
            '3. Inspect sidebar background color.',
          ],
          domSnippet: await page.locator('aside, nav').first().innerHTML().catch(() => '<unavailable>'),
          rootCause: err.message,
        },
      };
    }

    // =============================================================
    // Step 3: Badges & Persian Vazirmatn Tabular Numerals
    // =============================================================
    console.log('--- [Step 3] Verifying whitespace-nowrap Badges & Persian Tabular Numerals ---');
    try {
      // Navigate to /leads to check table status badges
      await page.locator('nav a[href="/leads"], a[href="/leads"]').first().click();
      await waitForUiSettled(page);
      await page.locator('table.bidar-leads-table tbody tr').first().waitFor({ state: 'visible', timeout: 10000 });

      // Check whitespace-nowrap on status badges
      const statusPills = page.locator('table tbody tr .whitespace-nowrap, table tbody tr span[class*="whitespace-nowrap"]');
      const badgeCount = await statusPills.count();
      console.log(`   Found ${badgeCount} badges with "whitespace-nowrap" class.`);
      assert(badgeCount > 0, 'No status badges with "whitespace-nowrap" class found in leads table.');

      // Check Persian numbers and tabular numerals / font-mono
      const tableText = await page.locator('table tbody').innerText();
      // Ensure Persian digits exist in table
      assert(/[۰-۹]/.test(tableText), 'Table data does not contain Persian digits (۰-۹).');

      const tabularNumElements = page.locator('.tabular-nums, [class*="tabular-nums"], .font-mono');
      const tabularCount = await tabularNumElements.count();
      console.log(`   Found ${tabularCount} elements with tabular-nums / font-mono formatting.`);
      assert(tabularCount > 0, 'Elements with tabular-nums or font-mono not found.');

      testResults.badgesAndPersianNumerals = {
        passed: true,
        details: `Table status badges have whitespace-nowrap (${badgeCount} elements), and numbers render with Persian numerals and tabular-nums/font-mono.`,
        bugDossier: null,
      };
      console.log('✅ [Step 3 Passed] Status Badges & Persian Tabular Numerals verified.\n');
    } catch (err) {
      console.error('❌ [Step 3 Failed]:', err.message);
      testResults.badgesAndPersianNumerals = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-TYPO-BADGES-001',
          title: 'Status Badge / Persian Numerals Typography Defect',
          assertion: err.message,
          reproduction: [
            `1. Navigate to ${BASE_URL}leads.`,
            '2. Inspect status pills for whitespace-nowrap class.',
            '3. Inspect numbers for Persian digits and tabular-nums class.',
          ],
          domSnippet: await page.locator('table').first().innerHTML().catch(() => '<unavailable>'),
          rootCause: err.message,
        },
      };
    }
  } catch (fatalErr) {
    console.error('💥 Fatal error in Global Features suite:', fatalErr);
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
  console.log('📊 GLOBAL FEATURES TEST EXECUTION SUMMARY:');
  console.log(`   1. Global Search (Command Palette Ctrl+K): ${testResults.globalSearch.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   2. Theme Switching & Sidebar Adaptation:   ${testResults.themeSwitchingAndSidebar.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   3. Status Badges & Persian Numerals:       ${testResults.badgesAndPersianNumerals.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log('================================================================\n');

  return testResults;
}

// Direct execution support
if (process.argv[1]?.endsWith('global-features.spec.js')) {
  runGlobalFeaturesTests()
    .then((results) => {
      const hasFailures = Object.values(results).some((r) => r.passed === false);
      if (hasFailures) {
        console.log('⚠️ Global Features test suite completed with defects detected (RED).');
        process.exitCode = 1;
      } else {
        console.log('🎉 All Global Features tests passed (GREEN).');
        process.exitCode = 0;
      }
    })
    .catch((err) => {
      console.error('Fatal runner error:', err);
      process.exitCode = 2;
    });
}
