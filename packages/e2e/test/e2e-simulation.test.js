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
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${server.address().port}`);

      // Helper to read JSON body
      const getJsonBody = () =>
        new Promise((resolve) => {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch {
              resolve({});
            }
          });
        });

      const token = req.headers['authorization'] || req.headers['espo-authorization'];

      // Route 1: Auth Handshake
      if (url.pathname === '/api/v1/App/user') {
        if (token) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ user: { id: '1', userName: 'admin', name: 'مدیر سیستم' }, token: 'token-abc' }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 401, message: 'Unauthorized' }));
        }
      }
      // Route 2: Dashboard Summary
      else if (url.pathname === '/api/v1/BidarDashboard/summary') {
        if (!token) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 401, message: 'Unauthorized' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            openDealsCount: 5,
            totalOpenAmount: 180000000,
            wonDealsCount: 3,
            rottenDealsCount: 1,
            funnel: [
              { stageId: 'stage-1', stageName: 'سرنخ جدید', count: 2, amount: 50000000 },
              { stageId: 'stage-2', stageName: 'مذاکره اولیه', count: 3, amount: 130000000 },
            ],
          })
        );
      }
      // Route 3: Pipelines & Kanban
      else if (url.pathname === '/api/v1/Pipeline') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            list: [
              {
                id: 'pipe-1',
                name: 'کاریز فروش مستقیم',
                stages: [
                  { id: 'stage-1', name: 'سرنخ جدید', order: 1 },
                  { id: 'stage-2', name: 'مذاکره اولیه', order: 2 },
                  { id: 'stage-3', name: 'پیش‌نویس قرارداد', order: 3 },
                ],
              },
            ],
            total: 1,
          })
        );
      }
      // Route 4: Opportunity Creation & Drag-and-Drop Stage Transitions
      else if (url.pathname === '/api/v1/Opportunity' && req.method === 'POST') {
        const body = await getJsonBody();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'deal-e2e-101',
            name: body.name || 'معامله تست E2E',
            amount: body.amount || 25000000,
            pipelineStageId: body.pipelineStageId || 'stage-1',
            stage: body.stage || 'سرنخ جدید',
            isRotten: true,
            daysSinceLastActivity: 9,
            createdAt: new Date().toISOString(),
          })
        );
      } else if (url.pathname.startsWith('/api/v1/Opportunity/') && req.method === 'PATCH') {
        const body = await getJsonBody();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'deal-e2e-101',
            pipelineStageId: body.pipelineStageId || 'stage-2',
            stage: body.stage || 'مذاکره اولیه',
            ...body,
          })
        );
      }
      // Route 5: Deal Stream & Rotten Reset Note
      else if (url.pathname.endsWith('/stream')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ list: [], total: 0 }));
      } else if (url.pathname === '/api/v1/Note' && req.method === 'POST') {
        const body = await getJsonBody();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'note-e2e-201',
            parentType: body.parentType || 'Opportunity',
            parentId: body.parentId,
            post: body.post,
            type: body.type || 'Note',
            createdByName: 'مدیر سیستم',
            createdAt: new Date().toISOString(),
          })
        );
      }
      // Route 6: Contacts & Accounts
      else if (url.pathname === '/api/v1/Contact' && req.method === 'POST') {
        const body = await getJsonBody();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'contact-e2e-301',
            firstName: body.firstName,
            lastName: body.lastName,
            name: body.name || `${body.firstName || ''} ${body.lastName || ''}`.trim(),
            phoneNumber: body.phoneNumber,
            emailAddress: body.emailAddress,
            accountName: body.accountName,
            createdAt: new Date().toISOString(),
          })
        );
      } else if (url.pathname === '/api/v1/Contact' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            list: [
              {
                id: 'contact-e2e-301',
                name: 'مهرداد پرهام',
                phoneNumber: '09121234567',
                emailAddress: 'parham@example.ir',
                accountName: 'شرکت فناوران هوشمند',
                createdAt: new Date().toISOString(),
              },
            ],
            total: 1,
          })
        );
      }
      // Route 7: Activities & Tasks
      else if (url.pathname === '/api/v1/Task' && req.method === 'POST') {
        const body = await getJsonBody();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'task-e2e-401',
            name: body.name,
            type: body.type || 'Task',
            priority: body.priority || 'Normal',
            status: 'Not Started',
            dateDue: body.dateDue || new Date().toISOString(),
            parentId: body.parentId,
            parentType: body.parentType,
            createdAt: new Date().toISOString(),
          })
        );
      } else if (url.pathname.startsWith('/api/v1/Task/') && req.method === 'PATCH') {
        const body = await getJsonBody();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 'task-e2e-401',
            status: body.status || 'Completed',
          })
        );
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

  it('full chain simulation: all 6 sequential scenarios (01 to 06) should run and pass', async () => {
    const scenarioNames = [
      '01-health-and-login.js',
      '02-dashboard-and-navigation.js',
      '03-kanban-create-and-dnd.js',
      '04-deal-detail-stream-and-rotten-reset.js',
      '05-contacts-and-accounts.js',
      '06-activities-and-jalali-calendar.js',
    ];

    const state = {};
    const context = {
      baseUrl,
      credentials: { username: 'admin', password: 'password123' },
      state,
    };

    for (const name of scenarioNames) {
      const scenarioPath = resolve(E2E_DIR, 'scenarios', name);
      const mod = await import(pathToFileURL(scenarioPath).href);
      const scenario = mod.default || mod;

      const res = await scenario.run(context);
      assert.strictEqual(res.ok, true, `Scenario ${name} should pass, got: ${res.error || res.message}`);
    }

    // Verify key state propagated across chain of responsibility
    assert.ok(state.token, 'state.token should be set by 01');
    assert.ok(state.kpis, 'state.kpis should be set by 02');
    assert.ok(state.dealId, 'state.dealId should be set by 03');
    assert.ok(state.noteId, 'state.noteId should be set by 04');
    assert.ok(state.contactId, 'state.contactId should be set by 05');
    assert.ok(state.taskId, 'state.taskId should be set by 06');
  });

  it('chain breakage: when a scenario fails, subsequent scenarios are skipped', async () => {
    const scenarioNames = [
      '01-health-and-login.js',
      '02-dashboard-and-navigation.js',
      '03-kanban-create-and-dnd.js',
      '04-deal-detail-stream-and-rotten-reset.js',
      '05-contacts-and-accounts.js',
      '06-activities-and-jalali-calendar.js',
    ];

    let chainBroken = false;
    const executed = [];
    const skipped = [];

    // Context with unreachable baseUrl -> 01 will fail
    const context = {
      baseUrl: 'http://127.0.0.1:1',
      credentials: { username: 'admin', password: 'password123' },
      state: {},
    };

    for (const name of scenarioNames) {
      const scenarioPath = resolve(E2E_DIR, 'scenarios', name);
      const mod = await import(pathToFileURL(scenarioPath).href);
      const scenario = mod.default || mod;

      if (chainBroken) {
        skipped.push(name);
        continue;
      }

      const res = await scenario.run(context);
      executed.push(res);
      if (!res.ok) {
        chainBroken = true;
      }
    }

    assert.strictEqual(executed.length, 1, 'Only scenario 01 should execute before failure');
    assert.strictEqual(executed[0].ok, false, 'Scenario 01 must fail');
    assert.strictEqual(skipped.length, 5, 'Subsequent 5 scenarios must be skipped');
  });
});
