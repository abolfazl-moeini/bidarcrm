import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const E2E_DIR = resolve(__dirname, '..');

describe('E2E Monitoring Boilerplate Contract', () => {
  it('should have monitor.config.js exporting valid configuration', async () => {
    const configPath = resolve(E2E_DIR, 'monitor.config.js');
    assert.ok(existsSync(configPath), 'monitor.config.js must exist');

    const configModule = await import(pathToFileURL(configPath).href);
    const config = configModule.default || configModule;

    assert.ok(config, 'Configuration object must be defined');
    assert.strictEqual(typeof config.serviceName, 'string', 'serviceName must be string');
    assert.ok(config.environments, 'environments must be configured');
    assert.ok(config.environments.local, 'local environment must be configured');
    assert.ok(config.environments.local.baseUrl, 'local baseUrl must be configured');
  });

  it('should have lib/scenario.js exporting ok and fail helpers', async () => {
    const helperPath = resolve(E2E_DIR, 'lib/scenario.js');
    assert.ok(existsSync(helperPath), 'lib/scenario.js must exist');

    const { ok, fail } = await import(pathToFileURL(helperPath).href);
    assert.strictEqual(typeof ok, 'function', 'ok helper must be a function');
    assert.strictEqual(typeof fail, 'function', 'fail helper must be a function');

    const passRes = ok('test-scenario', 120, 'All passed', { extra: 1 });
    assert.deepStrictEqual(passRes, {
      name: 'test-scenario',
      ok: true,
      durationMs: 120,
      message: 'All passed',
      extra: 1,
    });

    const failRes = fail('test-scenario', 45, new Error('Connection refused'), { step: 2 });
    assert.deepStrictEqual(failRes, {
      name: 'test-scenario',
      ok: false,
      durationMs: 45,
      message: 'Connection refused',
      error: 'Connection refused',
      step: 2,
    });
  });

  it('should discover scenarios complying with the scenario contract', async () => {
    const scenariosDir = resolve(E2E_DIR, 'scenarios');
    assert.ok(existsSync(scenariosDir), 'scenarios directory must exist');

    const scenarioFiles = readdirSync(scenariosDir).filter((f) => f.endsWith('.js'));
    assert.ok(scenarioFiles.length >= 1, 'At least 01-health-and-login.js must exist');

    for (const file of scenarioFiles) {
      const scenarioPath = resolve(scenariosDir, file);
      const mod = await import(pathToFileURL(scenarioPath).href);
      const scenario = mod.default || mod;

      assert.strictEqual(typeof scenario.name, 'string', `Scenario ${file} must export name string`);
      assert.strictEqual(typeof scenario.run, 'function', `Scenario ${file} must export run async function`);
    }
  });
});
