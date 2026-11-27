/** Shared utilities for the standalone Playwright browser scripts. */

const CLEANUP_ORDER = [
  'BidarDealItem',
  'Task',
  'Call',
  'Meeting',
  'Note',
  'Contact',
  'Opportunity',
  'Account',
  'Lead',
  'BidarProduct',
  'BidarGoal',
  'BidarSmsTemplate',
  'BidarApiKey',
];

export async function loginToApp(page, baseUrl, credentials, { classic = false } = {}) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

  if (classic) {
    const username = page.locator('input[name="username"], #field-userName');
    if (await username.isVisible().catch(() => false)) {
      await username.fill(credentials.username);
      await page.locator('input[name="password"], #field-password').fill(credentials.password);
      await page.locator('button#btn-login, button[type="submit"]').click();
    }
    await waitForVisible(page, '#navbar, #logout', 15000);
    return;
  }

  const username = page.locator('input[name="username"]');
  if (await username.isVisible().catch(() => false)) {
    await username.fill(credentials.username);
    await page.locator('input[name="password"]').fill(credentials.password);
    await page.locator('button[type="submit"]').click();
  }

  await waitForVisible(page, 'nav, main, [role="main"]', 15000);
}

export async function waitForVisible(page, locatorOrSelector, timeoutMs = 10000) {
  const locator = typeof locatorOrSelector === 'string' ? page.locator(locatorOrSelector).first() : locatorOrSelector;
  await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  return locator;
}

/** Wait for network quiet, then allow two animation frames for React rendering. */
export async function waitForUiSettled(page, timeoutMs = 5000) {
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  })).catch(() => {});
}

export async function triggerAndWaitForResponse(page, predicate, action, timeoutMs = 8000) {
  const [response] = await Promise.all([
    page.waitForResponse(predicate, { timeout: timeoutMs }),
    action(),
  ]);
  return response;
}

export async function assertResponseOk(response, label, allowedStatuses = [200, 201]) {
  const body = await response.text().catch(() => '<unreadable response body>');
  if (!allowedStatuses.includes(response.status())) {
    throw new Error(`${label} failed with HTTP ${response.status()} ${response.statusText()}: ${body.slice(0, 1000)}`);
  }
  return body;
}

/**
 * Track every successful entity POST and return a best-effort cleanup function.
 * The latest Espo headers are reused so cleanup works with token-authenticated SPAs.
 */
export function cleanupEntities(page) {
  const entities = new Map();
  const pendingReads = new Set();
  const responseReads = new WeakMap();
  let apiOrigin = null;
  let apiHeaders = {};

  const trackId = (entity, id) => {
    if (typeof entity !== 'string' || !entity || typeof id !== 'string' || !id) return;
    const ids = entities.get(entity) || [];
    if (!ids.includes(id)) ids.push(id);
    entities.set(entity, ids);
  };

  page.on('request', (request) => {
    try {
      const url = new URL(request.url());
      if (!url.pathname.startsWith('/api/v1/')) return;
      apiOrigin ||= url.origin;
      const headers = request.headers();
      if (headers['espo-authorization']) {
        apiHeaders = {
          'Espo-Authorization': headers['espo-authorization'],
          'Espo-Authorization-By-Token': headers['espo-authorization-by-token'] || 'true',
        };
      }
    } catch {}
  });

  const trackResponse = (response) => {
    if (response.request().method() !== 'POST') return Promise.resolve();
    const existingRead = responseReads.get(response);
    if (existingRead) return existingRead;

    let url;
    try {
      url = new URL(response.url());
    } catch {
      return Promise.resolve();
    }
    const match = url.pathname.match(/^\/api\/v1\/([^/]+)\/?$/);
    if (!match || response.status() < 200 || response.status() >= 300) return Promise.resolve();

    const pending = response.json().then((body) => {
      trackId(match[1], body?.id);
    }).catch(() => {});
    responseReads.set(response, pending);
    pendingReads.add(pending);
    pending.finally(() => pendingReads.delete(pending));
    return pending;
  };

  page.on('response', trackResponse);

  const cleanup = async () => {
    await Promise.all([...pendingReads]);
    const origin = apiOrigin || (page.url() === 'about:blank' ? null : new URL(page.url()).origin);
    if (!origin) return;

    for (const entity of CLEANUP_ORDER) {
      const ids = [...(entities.get(entity) || [])].reverse();
      for (const id of ids) {
        try {
          const response = await page.context().request.delete(
            `${origin}/api/v1/${entity}/${encodeURIComponent(id)}`,
            { headers: apiHeaders, timeout: 5000 },
          );
          if (!response.ok() && response.status() !== 404) {
            console.warn(`Cleanup ${entity}/${id} returned HTTP ${response.status()}`);
          }
        } catch (error) {
          console.warn(`Cleanup ${entity}/${id} failed: ${error.message}`);
        }
      }
    }
  };

  cleanup.trackResponse = trackResponse;
  cleanup.trackId = trackId;
  return cleanup;
}

export function formatFutureDate(daysAhead = 1, hour = 10, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, minute, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Record fatal setup/execution errors on a result so standalone scripts exit non-zero. */
export function recordFatalError(testResults, error, page) {
  const result = testResults.auth || testResults.classicLoginPage || Object.values(testResults)[0];
  result.passed = false;
  result.details = error instanceof Error ? error.message : String(error);
  result.setupError = {
    message: result.details,
    stack: error instanceof Error ? error.stack : undefined,
    url: page?.url?.(),
    status: error?.status ?? null,
    responseBody: error?.responseBody ?? error?.body ?? null,
  };
  return result;
}
