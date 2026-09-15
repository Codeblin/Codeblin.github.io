/**
 * Process supervisor for local development.
 *
 * Starts the publication, the CMS UI, and the CMS API as three child
 * processes. Killing this process kills all three. No `concurrently`
 * dependency — see ARCHITECTURE.md §2.3.
 */

import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const fonts = spawnSync(process.execPath, ['scripts/build-fonts.mjs'], { stdio: 'inherit' });
if (fonts.status !== 0) process.exit(fonts.status ?? 1);
const grain = spawnSync(process.execPath, ['scripts/build-grain.mjs'], { stdio: 'inherit' });
if (grain.status !== 0) process.exit(grain.status ?? 1);

const children = [];

function run(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  });
  child.on('exit', (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(`[${name}] exited ${code} — other processes keep running`);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('web', 'npm', ['run', 'dev', '--workspace', '@codeblin/web']);
run('cms-api', 'npm', ['run', 'dev:api', '--workspace', '@codeblin/cms']);
run('cms-ui', 'npm', ['run', 'dev:ui', '--workspace', '@codeblin/cms']);

console.log(`
  publication  http://localhost:4321
  cms          http://localhost:4322
  cms api      http://127.0.0.1:4323
`);
