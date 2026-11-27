/**
 * BidarCRM - Monitoring & E2E Suite Configuration
 * Based on @wpdev/monitor-core and monitoring-boilerplate
 */
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env using native Node.js support. A missing file is optional;
// unsupported runtimes and malformed files must fail loudly.
const envPath = resolve(__dirname, '.env');
if (existsSync(envPath)) {
  if (typeof process.loadEnvFile !== 'function') {
    throw new Error('Loading .env requires Node.js 20.12 or newer.');
  }
  process.loadEnvFile(envPath);
}

const env = process.env.MONITOR_ENV || 'local';

export default {
  serviceName: 'BidarCRM',
  environment: env,
  environments: {
    local: {
      baseUrl: process.env.LOCAL_BASE_URL || 'http://localhost:8089',
      credentials: {
        username: process.env.LOCAL_USER || 'admin',
        password: process.env.LOCAL_PASSWORD || 'admin',
      },
    },
    staging: {
      baseUrl: process.env.STAGING_BASE_URL || 'https://staging.crm.example.com',
      credentials: {
        username: process.env.STAGING_USER || 'admin',
        password: process.env.STAGING_PASSWORD || '',
      },
    },
    prod: {
      baseUrl: process.env.PROD_BASE_URL || 'https://crm.example.com',
      credentials: {
        username: process.env.PROD_USER || 'monitor_user',
        password: process.env.PROD_PASSWORD || '',
      },
    },
  },
  timeoutMs: 30000,
  browser: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
};
