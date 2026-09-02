#!/usr/bin/env node
/**
 * Chaos automation — service unavailable simulation.
 */
import { ENVIRONMENT } from '../../packages/config/src/flags.ts';
import { startSunReyPreview } from '../../services/api/src/preview.ts';

if (ENVIRONMENT !== 'simulation') {
  console.error('[chaos:service-unavailable] refused — ENVIRONMENT must be simulation');
  process.exit(1);
}

const down = await startSunReyPreview({ allowSandboxPersonas: true, providerDown: true });
const health = await fetch(`${down.url}/health`);
const home = await fetch(`${down.url}/api/v1/me/home`, {
  headers: { accept: 'application/json', authorization: 'Bearer invalid' },
});
await down.close();

const passed = health.ok && (home.status === 401 || home.status === 403);
console.log(JSON.stringify({
  scenario: 'service-unavailable',
  healthStatus: health.status,
  unauthenticatedHome: home.status,
  passed,
}, null, 2));
process.exit(passed ? 0 : 1);
