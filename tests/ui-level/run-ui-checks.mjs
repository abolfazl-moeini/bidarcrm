#!/usr/bin/env node
/**
 * BidarCRM - ui-level Multi-Screen Regression Test Runner
 *
 * Runs deterministic visual and geometric checks across front-office screens
 * using the ui-level warm background daemon.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '../..');

const UI_LEVEL_CLI = process.env.UI_LEVEL_CLI || '/Users/moeini/Dev/ui-level/dist/cli.js';

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const noDaemon = args.includes('--no-daemon');
const screenFilterIndex = args.indexOf('--screen');
const screenFilter = screenFilterIndex !== -1 ? args[screenFilterIndex + 1] : null;

const manifestPathIndex = args.indexOf('--manifest');
const manifestPath = manifestPathIndex !== -1
  ? resolve(process.cwd(), args[manifestPathIndex + 1])
  : resolve(__dirname, 'manifest.json');

console.log('==> BidarCRM ui-level Multi-Screen Verification Runner');
console.log(`    Manifest: ${manifestPath}`);
console.log(`    Engine:   ${UI_LEVEL_CLI}`);
console.log(`    Dry-run:  ${isDryRun ? 'YES' : 'NO'}`);

if (!existsSync(manifestPath)) {
  console.error(`FATAL: Manifest file not found: ${manifestPath}`);
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`FATAL: Failed to parse manifest JSON: ${err.message}`);
  process.exit(2);
}

const screens = manifest.screens || [];
const targetScreens = screenFilter
  ? screens.filter((s) => s.id === screenFilter)
  : screens;

if (targetScreens.length === 0) {
  console.warn(`WARNING: No screens matched criteria (filter: ${screenFilter || 'none'}).`);
  process.exit(0);
}

if (isDryRun) {
  console.log('\n[DRY RUN] Validating screen definitions:');
  let hasErrors = false;
  for (const screen of targetScreens) {
    const refPath = resolve(ROOT_DIR, screen.ref);
    const refExists = existsSync(refPath);
    console.log(`  - [${screen.id}] "${screen.name}": target=${screen.targetUrl}, ref=${screen.ref} (${refExists ? 'EXISTS' : 'PENDING'})`);
    if (!screen.targetUrl || !screen.ref || !screen.selector) {
      console.error(`    ERROR: Missing required fields on screen ${screen.id}`);
      hasErrors = true;
    }
  }
  process.exit(hasErrors ? 2 : 0);
}

// Ensure CLI exists
if (!existsSync(UI_LEVEL_CLI)) {
  console.error(`FATAL: ui-level CLI not found at ${UI_LEVEL_CLI}`);
  process.exit(2);
}

let daemonStarted = false;
let allPassed = true;
let totalExecuted = 0;
let totalPassed = 0;
let totalFailed = 0;
let totalSkipped = 0;

try {
  if (!noDaemon) {
    try {
      execSync(`node "${UI_LEVEL_CLI}" daemon start`, { stdio: 'pipe' });
      daemonStarted = true;
      console.log('==> Warm background daemon active.');
    } catch (daemonErr) {
      console.warn('==> Warning: Could not start daemon, falling back to direct mode.');
    }
  }

  for (const screen of targetScreens) {
    totalExecuted++;
    const refPath = resolve(ROOT_DIR, screen.ref);

    if (!existsSync(refPath)) {
      console.log(`\n[SKIP] Screen "${screen.name}" (${screen.id}): Reference file ${screen.ref} not yet generated.`);
      totalSkipped++;
      continue;
    }

    console.log(`\n==> Testing screen "${screen.name}" (${screen.id})...`);
    const cliArgs = [
      'check',
      '--json',
      '-t', screen.targetUrl,
      '-r', refPath,
      '-a', screen.adapter || 'html',
      '-s', screen.selector || '#root',
      '--viewport', `${screen.viewport?.width || 1280}x${screen.viewport?.height || 800}`,
      '--dpr', String(screen.viewport?.deviceScaleFactor || 2),
      '--threshold', String(screen.geometryTolerancePx || 0.5),
    ];

    if (!noDaemon && daemonStarted) {
      cliArgs.push('--daemon');
    }

    if (screen.maskSelectors && screen.maskSelectors.length > 0) {
      cliArgs.push('--mask', ...screen.maskSelectors);
    }

    try {
      const output = execFileSync('node', [UI_LEVEL_CLI, ...cliArgs], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const result = JSON.parse(output);
      if (result.ok || result.status === 'passed') {
        console.log(`  [PASS] Screen "${screen.name}": DeltaE and pixel diff within thresholds.`);
        totalPassed++;
      } else {
        console.error(`  [FAIL] Screen "${screen.name}": Differences detected.`);
        allPassed = false;
        totalFailed++;
      }
    } catch (execErr) {
      console.error(`  [FAIL] Screen "${screen.name}" check exited with error: ${execErr.message}`);
      allPassed = false;
      totalFailed++;
    }
  }
} finally {
  if (daemonStarted) {
    try {
      execSync(`node "${UI_LEVEL_CLI}" daemon stop`, { stdio: 'pipe' });
      console.log('==> Background daemon stopped.');
    } catch (_) {
      // Ignore error during stop
    }
  }
}

console.log('\n=== Summary ===');
console.log(`Total:   ${totalExecuted}`);
console.log(`Passed:  ${totalPassed}`);
console.log(`Failed:  ${totalFailed}`);
console.log(`Skipped: ${totalSkipped}`);

if (!allPassed) {
  process.exit(1);
}
process.exit(0);
