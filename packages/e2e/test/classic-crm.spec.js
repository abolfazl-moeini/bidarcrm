/**
 * BidarCRM E2E Test Suite - Section 8.1: Classic EspoCRM RTL & Layout Verification (`http://localhost:8089/admin/`)
 *
 * Real browser-driven Playwright test verifying:
 * 1. Classic Login Page (`http://localhost:8089/admin/`):
 *    - Persian language and RTL orientation (html[dir="rtl"] and body[dir="rtl"]).
 *    - Balanced, centered logo presentation.
 *    - Successful authentication with admin credentials.
 * 2. Classic Dashboard Post-Login:
 *    - Verification of navbar position: strictly positioned on the RIGHT side of the screen (x >= 1000px on 1440px viewport).
 *    - Verification that navbar is NOT placed on the left side (x != 0).
 *    - Verification of content alignment (#content): proper right margin (marginRight >= 200px) preventing sidebar overlap.
 */

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { cleanupEntities, recordFatalError, waitForVisible } from '../lib/test-helpers.js';

const CLASSIC_URL = process.env.CLASSIC_URL || 'http://localhost:8089/';
const CREDENTIALS = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin',
};

export async function runClassicCrmTests() {
  console.log('================================================================');
  console.log('🚀 Starting BidarCRM E2E Pipeline: Section 8.1 (نسخه کلاسیک اسپو)');
  console.log(`🎯 Target URL: ${CLASSIC_URL}`);
  console.log('================================================================\n');

  const testResults = {
    classicLoginPage: { passed: false, details: null, bugDossier: null },
    classicDashboardRtl: { passed: false, details: null, bugDossier: null },
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

    // =============================================================
    // Step 1: Classic Login Page (RTL & Logo)
    // =============================================================
    console.log('--- [Step 1] Verifying Classic Login Page (RTL & Centered Logo) ---');
    try {
      await page.goto(CLASSIC_URL, { waitUntil: 'networkidle' });

      // 1. Check RTL layout
      const htmlDir = await page.locator('html').getAttribute('dir');
      const bodyDir = (await page.locator('body').getAttribute('dir')) || (await page.locator('body').getAttribute('data-direction'));
      console.log(`   HTML dir: "${htmlDir}", Body dir: "${bodyDir}"`);

      assert(
        htmlDir === 'rtl' || bodyDir === 'rtl',
        `Expected Classic Login page to have RTL layout (html[dir="rtl"] or body[dir="rtl"]), got html="${htmlDir}", body="${bodyDir}"`
      );

      // 2. Check Logo presentation
      const loginFormInput = page.locator('input[name="username"], input[name="userName"], #field-userName').first();
      await waitForVisible(page, loginFormInput, 15000);

      const logoEl = page.locator('.logo-container, .logo, .login-logo, img[src*="logo"]').first();
      await waitForVisible(page, logoEl, 15000);
      assert((await logoEl.count()) > 0, 'Logo element not found on Classic login page.');
      const logoBox = await logoEl.boundingBox();
      assert(logoBox !== null, 'Could not calculate logo bounding box.');
      console.log(`   Logo Bounding Box: x=${logoBox.x}, y=${logoBox.y}, width=${logoBox.width}, height=${logoBox.height}`);

      // In a 1440px viewport, centered logo should have x coordinate around the center (e.g. 500-900px)
      const logoCenterX = logoBox.x + logoBox.width / 2;
      console.log(`   Logo center X: ${logoCenterX}px (Viewport width: 1440px)`);
      assert(
        logoCenterX > 400 && logoCenterX < 1040,
        `Logo is not properly centered horizontally. Center X: ${logoCenterX}px`
      );

      // 3. Perform login
      console.log('   Logging in with admin credentials...');
      const usernameInput = page.locator('input[name="username"], #field-userName');
      await usernameInput.fill(CREDENTIALS.username);
      await page.locator('input[name="password"], #field-password').fill(CREDENTIALS.password);
      await page.locator('button#btn-login, button[type="submit"]').click();

      // Wait for navigation / dashboard load
      const navbarEl = page.locator('#navbar .navbar, .navbar-inverse, .side-navbar').first();
      await waitForVisible(page, navbarEl, 15000);
      console.log('   Successfully authenticated into Classic CRM.\n');

      testResults.classicLoginPage = {
        passed: true,
        details: `Classic Login page RTL layout verified (html[dir="${htmlDir}"]), logo centered at x=${Math.round(logoCenterX)}px, and authentication succeeded.`,
        bugDossier: null,
      };
      console.log('✅ [Step 1 Passed] Classic Login Page verified.\n');
    } catch (err) {
      console.error('❌ [Step 1 Failed]:', err.message);
      testResults.classicLoginPage = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-CLASSIC-LOGIN-001',
          title: 'Classic CRM Login Page RTL / Logo Defect',
          assertion: err.message,
          reproduction: [
            `1. Navigate to ${CLASSIC_URL}.`,
            '2. Check html[dir] and body[dir] attributes.',
            '3. Check logo element centering.',
          ],
          domSnippet: await page.locator('body').innerHTML().catch(() => '<unavailable>'),
          rootCause: err.message,
        },
      };
    }

    // =============================================================
    // Step 2: Classic Dashboard Post-Login Navbar & RTL Alignment
    // =============================================================
    console.log('--- [Step 2] Verifying Classic Dashboard Navbar Right-Side Position & Content Margin ---');
    try {
      // 1. Post-login RTL check
      const postHtmlDir = await page.locator('html').getAttribute('dir');
      console.log(`   Post-login HTML dir: "${postHtmlDir}"`);
      assert(postHtmlDir === 'rtl', `Expected post-login HTML to have dir="rtl", got "${postHtmlDir}"`);

      // 2. Locate Navbar
      const navbar = page.locator('#navbar .navbar, .navbar-inverse, .side-navbar').first();
      await waitForVisible(page, navbar);

      const navBox = await navbar.boundingBox();
      assert(navBox !== null, 'Could not retrieve navbar bounding box.');
      console.log(`   Navbar Bounding Box: x=${navBox.x}, width=${navBox.width}`);

      // Crucial assertion: Navbar MUST be on the right side of the screen (x >= 1000px on 1440px viewport)
      // and NOT on the left (x != 0)
      assert(
        navBox.x >= 1000,
        `Navbar is positioned at x=${navBox.x}px. In RTL, navbar MUST be positioned on the RIGHT side of the screen (x >= 1000px on 1440px width), NOT on the left.`
      );
      assert(
        navBox.x + navBox.width >= 1400,
        `Navbar does not span to the right edge of viewport. Right edge is at ${navBox.x + navBox.width}px, expected >= 1400px.`
      );
      console.log(`   Navbar correctly located on the RIGHT side: x=${navBox.x}px to ${navBox.x + navBox.width}px.`);

      // 3. Locate Main Content (#content) and verify right margin
      const content = page.locator('#content, .main-content').first();
      await waitForVisible(page, content);

      const contentBox = await content.boundingBox();
      assert(contentBox !== null, 'Could not retrieve visible content bounding box.');
      const contentStyles = await content.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          marginRight: parseFloat(cs.marginRight) || 0,
          marginLeft: parseFloat(cs.marginLeft) || 0,
          paddingRight: parseFloat(cs.paddingRight) || 0,
        };
      });

      console.log(`   Content Bounding Box: x=${contentBox.x}, width=${contentBox.width}`);
      console.log(`   Content Computed Styles: marginRight=${contentStyles.marginRight}px, marginLeft=${contentStyles.marginLeft}px`);

      assert(
        contentStyles.marginRight >= 200 || contentBox.x + contentBox.width <= navBox.x + 20,
        `Content does not have adequate right margin (marginRight=${contentStyles.marginRight}px) to prevent overlapping right sidebar (width=${navBox.width}px).`
      );

      testResults.classicDashboardRtl = {
        passed: true,
        details: `Classic Dashboard verified: html[dir="rtl"], navbar anchored at right edge (x=${navBox.x}px, width=${navBox.width}px), and #content has marginRight=${contentStyles.marginRight}px preventing overlap.`,
        bugDossier: null,
      };
      console.log('✅ [Step 2 Passed] Classic Dashboard Navbar Right-Side Position & Content Margin verified.\n');
    } catch (err) {
      console.error('❌ [Step 2 Failed]:', err.message);
      testResults.classicDashboardRtl = {
        passed: false,
        details: err.message,
        bugDossier: {
          identifier: 'BUG-BIDAR-CLASSIC-RTL-001',
          title: 'Classic CRM RTL Navbar Alignment Defect',
          assertion: err.message,
          reproduction: [
            `1. Log in to ${CLASSIC_URL}.`,
            '2. Inspect position of #navbar: check if it is anchored to the right side of the screen.',
            '3. Check #content marginRight to ensure no sidebar overlap.',
          ],
          domSnippet: await page.locator('#navbar').innerHTML().catch(() => '<unavailable>'),
          rootCause: err.message,
        },
      };
    }
  } catch (fatalErr) {
    console.error('💥 Fatal error in Classic CRM suite:', fatalErr);
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
  console.log('📊 CLASSIC CRM TEST EXECUTION SUMMARY:');
  console.log(`   1. Classic Login Page (RTL & Logo):      ${testResults.classicLoginPage.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log(`   2. Classic Dashboard Navbar Right-Side:  ${testResults.classicDashboardRtl.passed ? 'PASSED (GREEN)' : 'FAILED (RED)'}`);
  console.log('================================================================\n');

  return testResults;
}

// Direct execution support
if (process.argv[1]?.endsWith('classic-crm.spec.js')) {
  runClassicCrmTests()
    .then((results) => {
      const hasFailures = Object.values(results).some((r) => r.passed === false);
      if (hasFailures) {
        console.log('⚠️ Classic CRM test suite completed with defects detected (RED).');
        process.exitCode = 1;
      } else {
        console.log('🎉 All Classic CRM tests passed (GREEN).');
        process.exitCode = 0;
      }
    })
    .catch((err) => {
      console.error('Fatal runner error:', err);
      process.exitCode = 2;
    });
}
