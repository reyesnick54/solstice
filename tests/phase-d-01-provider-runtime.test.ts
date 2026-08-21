import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { computeCapabilities } from '../services/api/src/consumer/capabilities.ts';
import { createSandboxWorld, sandboxToken } from '../services/api/src/consumer/fixtures.ts';
import {
  LIVE_CONNECTIVITY_ENABLED,
  PRODUCTION_ACTIVE,
  PRODUCTION_READY,
  createUniversalProviderRuntime,
  production_authorized,
  seedSimulationProviders,
} from '../packages/sunrey-chain/src/provider-runtime/universal/index.ts';

const ROOT = join(import.meta.dirname, '..');
const NOW = '2026-08-21T16:00:00.000Z';

describe('Phase D Prompt 1 productization gate', () => {
  it('documents the provider runtime and integration standard', () => {
    assert.equal(existsSync(join(ROOT, 'docs/productization/PHASE_D_01_PROVIDER_RUNTIME.md')), true);
    assert.equal(existsSync(join(ROOT, 'docs/productization/SUNREY_PROVIDER_INTEGRATION_STANDARD.md')), true);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-chain/src/provider-runtime/universal/runtime.ts')), true);
    assert.equal(existsSync(join(ROOT, 'packages/provider-runtime')), false);
    assert.equal(existsSync(join(ROOT, 'db/customer/migrations/V033__provider_runtime.sql')), true);
    const doc = readFileSync(join(ROOT, 'docs/productization/PHASE_D_01_PROVIDER_RUNTIME.md'), 'utf8');
    assert.match(doc, /PRODUCTION_READY=false/);
    assert.match(doc, /LIVE_CONNECTIVITY_ENABLED=false/);
    assert.match(doc, /SAFE_TO_PROCEED_TO_PHASE_D_PROMPT_2/);
  });

  it('keeps production flags closed', () => {
    assert.equal(PRODUCTION_READY, false);
    assert.equal(PRODUCTION_ACTIVE, false);
    assert.equal(LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(production_authorized, false);
  });

  it('derives BFF paymentsEnabled from provider lifecycle and health', () => {
    const runtime = createUniversalProviderRuntime();
    const base = {
      actorId: 'actor_1',
      customerId: 'cust_1',
      identityId: 'id_1',
      sessionId: 'sess_1',
      jurisdiction: 'US',
      verification: 'VERIFIED' as const,
      customerStatus: 'ACTIVE',
      identityStatus: 'ACTIVE',
      capabilities: ['PAYMENT_REQUEST', 'FX_QUOTE_REQUEST', 'CARD_MANAGE_REQUEST'],
      risk: 'LOW' as const,
      restricted: false,
      sandboxPersona: null,
      deviceSummary: { deviceId: null, trustState: null },
    };
    const unconfigured = computeCapabilities({ principal: base, providerRuntime: runtime });
    assert.equal(unconfigured.paymentsEnabled, false);
    seedSimulationProviders(runtime, NOW);
    const sandbox = computeCapabilities({ principal: base, providerRuntime: runtime });
    assert.equal(sandbox.paymentsEnabled, true);
    assert.equal(sandbox.details.payments.provider, 'SIMULATED');
    runtime.observeHealth({ providerId: 'sim-payments', success: false, latencyMs: null, nowUtc: NOW });
    runtime.observeHealth({ providerId: 'sim-payments', success: false, latencyMs: null, nowUtc: NOW });
    runtime.observeHealth({ providerId: 'sim-payments', success: false, latencyMs: null, nowUtc: NOW });
    const down = computeCapabilities({ principal: base, providerRuntime: runtime });
    assert.equal(down.paymentsEnabled, false);
    assert.equal(down.details.payments.state, 'PROVIDER_UNAVAILABLE');
  });

  it('sandbox world still exposes safe feature availability', () => {
    const world = createSandboxWorld();
    const capabilities = world.bff.capabilities(world.personas.basic_verified);
    assert.equal(capabilities.paymentsEnabled, true);
    assert.equal(capabilities.fxEnabled, true);
    assert.equal(capabilities.cardsEnabled, true);
    void sandboxToken;
  });
});
