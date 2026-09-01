#!/usr/bin/env node
/**
 * Controlled live AI provider certification (Wave 4 Prompt 12).
 * Does not leak prompts containing sensitive user information.
 * Pass --live to attempt external xAI connectivity when credentials are configured.
 */
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  CloudRunSecretProvider,
  InMemorySecretProvider,
  parseSecretReference,
} from '../packages/security/src/secrets.ts';
import { runAiCertificationHarness } from '../packages/ai-runtime/src/certification/harness.ts';
import { resolveXaiGrokProviderConfig } from '../packages/ai-runtime/src/providers/xai-grok/configuration.ts';

const live = process.argv.includes('--live');
const now = asUtcInstant('2026-08-31T16:00:00.000Z');
const clock = new FrozenClock(now);
const config = resolveXaiGrokProviderConfig();

function resolveSecrets(): InMemorySecretProvider | CloudRunSecretProvider | null {
  const envKey = process.env.SUNREY_SECRET_XAI_API_KEY;
  if (envKey && envKey.length > 0) {
    return new InMemorySecretProvider('simulation', { 'xai-api-key': envKey });
  }
  if (!config.credentialRef) {
    return null;
  }
  const parsed = parseSecretReference(config.credentialRef.href);
  if (!parsed.ok) {
    return null;
  }
  if (parsed.value.provider === 'cloud-run') {
    return new CloudRunSecretProvider();
  }
  return null;
}

const report = runAiCertificationHarness({
  clock,
  secrets: resolveSecrets(),
  live,
  nowUtc: now,
});

console.log(JSON.stringify(report, null, 2));

if (live && !report.xai.inferenceSuccessful) {
  process.exit(2);
}
