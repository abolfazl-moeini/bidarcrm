/**
 * BidarCRM - E2E Scenario Runner
 * Executes scenarios sequentially according to Chain of Responsibility.
 */
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import config from './monitor.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const envName = config.environment || 'local';
  const envConfig = config.environments[envName] || config.environments.local;

  console.log(`==> Running BidarCRM E2E Monitor against [${envName}] (${envConfig.baseUrl})`);

  const scenariosDir = resolve(__dirname, 'scenarios');
  const files = readdirSync(scenariosDir)
    .filter((f) => f.endsWith('.js'))
    .sort();

  const sharedState = {};
  let chainBroken = false;
  let brokenReason = null;
  const results = [];

  try {
  for (const file of files) {
    const scenarioPath = resolve(scenariosDir, file);
    const mod = await import(pathToFileURL(scenarioPath).href);
    const scenario = mod.default || mod;

    if (chainBroken) {
      console.log(`[SKIP] Scenario ${scenario.name} (Chain broken by preceding failure: ${brokenReason})`);
      results.push({ name: scenario.name, ok: false, skipped: true, reason: brokenReason });
      continue;
    }

    console.log(`==> Running ${scenario.name}...`);
    try {
      const res = await scenario.run({
        baseUrl: envConfig.baseUrl,
        credentials: envConfig.credentials,
        state: sharedState,
        timeoutMs: config.timeoutMs,
      });

      results.push(res);
      if (res.ok) {
        console.log(`  [PASS] ${res.name} (${res.durationMs}ms): ${res.message}`);
      } else {
        console.error(`  [FAIL] ${res.name} (${res.durationMs}ms): ${res.error || res.message}`);
        chainBroken = true;
        brokenReason = res.error || res.message;
      }
    } catch (err) {
      console.error(`  [ERROR] ${scenario.name}: ${err.message}`);
      chainBroken = true;
      brokenReason = err.message;
      results.push({ name: scenario.name, ok: false, error: err.message });
    }
  }
  } finally {
    const auth = sharedState.token
      ? Buffer.from(`${sharedState.username || envConfig.credentials.username}:${sharedState.token}`).toString('base64')
      : null;
    const headers = auth ? { 'Espo-Authorization': auth, 'Espo-Authorization-By-Token': 'true' } : {};
    for (const [entity, id] of [['Task', sharedState.taskId], ['Note', sharedState.noteId], ['Contact', sharedState.contactId], ['Opportunity', sharedState.dealId]]) {
      if (!id) continue;
      try {
        const response = await fetch(`${envConfig.baseUrl}/api/v1/${entity}/${encodeURIComponent(id)}`, {
          method: 'DELETE', headers, signal: AbortSignal.timeout(config.timeoutMs),
        });
        if (!response.ok && response.status !== 404) console.warn(`Cleanup ${entity}/${id} returned HTTP ${response.status}`);
      } catch (error) {
        console.warn(`Cleanup ${entity}/${id} failed: ${error.message}`);
      }
    }
  }

  const allPassed = results.length > 0 && results.every((r) => r.ok);
  if (!allPassed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exitCode = 2;
});
