#!/usr/bin/env node
/**
 * Chaos automation — restart sandbox preview server.
 * Restricted to non-production environments.
 */
import { ENVIRONMENT } from '../../packages/config/src/flags.ts';
import { sandboxToken } from '../../services/api/src/consumer/sandbox-personas.ts';
import { startSunReyPreview } from '../../services/api/src/preview.ts';

if (ENVIRONMENT !== 'simulation') {
  console.error('[chaos:restart] refused — ENVIRONMENT must be simulation');
  process.exit(1);
}

const preview = await startSunReyPreview({ allowSandboxPersonas: true });
const token = sandboxToken('grow_healthy_saver');
const before = await fetch(`${preview.url}/health`);
await preview.close();

const restarted = await startSunReyPreview({ allowSandboxPersonas: true });
const after = await fetch(`${restarted.url}/health`);
const home = await fetch(`${restarted.url}/api/v1/me/home`, {
  headers: { accept: 'application/json', authorization: `Bearer ${token}` },
});
await restarted.close();

const ok = before.ok && after.ok;
console.log(JSON.stringify({
  scenario: 'restart-sandbox',
  healthBefore: before.status,
  healthAfter: after.status,
  homeAfter: home.status,
  passed: ok,
}, null, 2));
process.exit(ok ? 0 : 1);
