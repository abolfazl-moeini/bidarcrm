import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specs = readdirSync(resolve(root, 'test')).filter((file) => file.endsWith('.spec.js')).sort();
let failed = false;

for (const spec of specs) {
  console.log(`\n==> Browser spec: ${spec}`);
  const result = spawnSync(process.execPath, [resolve(root, 'test', spec)], { stdio: 'inherit', cwd: root, env: process.env });
  if (result.error) {
    console.error(`${spec} could not start: ${result.error.message}`);
    failed = true;
  } else if (result.status !== 0) {
    console.error(`${spec} exited with status ${result.status ?? 'signal termination'}`);
    failed = true;
  }
}

process.exitCode = failed ? 1 : 0;
