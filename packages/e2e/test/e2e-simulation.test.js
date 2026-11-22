import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const E2E_DIR = resolve(__dirname, '..');

describe('E2E Offline Simulation & Chain of Responsibility', () => {
  let server;
  let serverPort;
  let baseUrl;

  before((_, done) => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${server.address().port}`);
      if (url.pathname === '/api/v1/App/user') {
        const auth = req.headers['authorization'] || req.headers['espo-authorization'];
        if (auth) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ user: { id: '1', userName: 'admin' }, token: 'token-abc' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 401, message: 'Unauthorized' }));
        }
      } else if (url.pathname === '/app/login' || url.pathname === '/app') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!DOCTYPE html><html><body><div id="root">BidarCRM App</div></body></html>');
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      baseUrl = `http://127.0.0.1:${serverPort}`;
      done();
    });
  });

  after((_, done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('scenario 01-health-and-login should pass with valid mock endpoints', async () => {
    const scenarioPath = resolve(E2E_DIR, 'scenarios/01-health-and-login.js');
    const mod = await import(pathToFileURL(scenarioPath).href);
    const scenario = mod.default || mod;

    const mockContext = {
      baseUrl,
      credentials: { username: 'admin', password: 'password123' },
      state: {},
    };

    const result = await scenario.run(mockContext);
    assert.strictEqual(result.ok, true, 'Result ok must be true on successful login');
    assert.strictEqual(typeof result.durationMs, 'number');
    assert.ok(result.token, 'Should extract auth token from simulation');
  });

  it('scenario 01-health-and-login should return ok:false when endpoint fails', async () => {
    const scenarioPath = resolve(E2E_DIR, 'scenarios/01-health-and-login.js');
    const mod = await import(pathToFileURL(scenarioPath).href);
    const scenario = mod.default || mod;

    const mockContext = {
      baseUrl: 'http://127.0.0.1:1', // unreachable port
      credentials: { username: 'admin', password: 'password123' },
      state: {},
    };

    const result = await scenario.run(mockContext);
    assert.strictEqual(result.ok, false, 'Result ok must be false when endpoint fails');
    assert.ok(result.error, 'Result must include error message');
  });
});
