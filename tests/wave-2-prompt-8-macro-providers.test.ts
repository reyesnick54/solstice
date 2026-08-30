import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CANONICAL_INDICATORS,
  createMacroProviderRuntime,
  getProviderNativeId,
  MACRO_ADAPTER_IDS,
  MACRO_REFRESH_SCHEDULES,
  normalizeCountryCode,
  resolveCanonicalIndicatorId,
  toAgentEvidenceRef,
} from '../packages/sunrey-chain/src/macro/index.ts';

describe('Wave 2 Prompt 8 macro providers', () => {
  it('normalizes country codes and indicator mappings', () => {
    assert.equal(normalizeCountryCode('United States'), 'US');
    assert.equal(normalizeCountryCode('Saudi Arabia'), 'SA');
    assert.equal(resolveCanonicalIndicatorId('fred', 'CPIAUCSL'), CANONICAL_INDICATORS.US_CPI);
    assert.equal(getProviderNativeId(CANONICAL_INDICATORS.US_CPI, 'fred'), 'CPIAUCSL');
  });

  it('registers all macro adapters in simulation runtime', () => {
    const runtime = createMacroProviderRuntime({ mode: 'simulation' });
    assert.equal(runtime.adapters.size, MACRO_ADAPTER_IDS.length);
    assert.equal(runtime.registry.list().length, MACRO_ADAPTER_IDS.length);
    assert.ok(MACRO_REFRESH_SCHEDULES.length >= MACRO_ADAPTER_IDS.length);
  });

  it('fetches CPI via MacroDataService with fixture transport', async () => {
    const runtime = createMacroProviderRuntime({ mode: 'simulation' });
    const result = await runtime.service.getIndicator(CANONICAL_INDICATORS.US_CPI, 'US');
    assert.ok(result);
    assert.equal(result!.providerId, 'fred');
    assert.ok(result!.data.value !== null);
    assert.equal(result!.data.country, 'US');
  });

  it('exposes read-only agent evidence without execution authority', async () => {
    const runtime = createMacroProviderRuntime({ mode: 'simulation' });
    const adapter = runtime.adapters.get('fred');
    assert.ok(adapter);
    const observation = await adapter!.fetchIndicator('CPIAUCSL', 'US');
    assert.equal(observation.ok, true);
    if (!observation.ok) {
      return;
    }
    const evidence = toAgentEvidenceRef(observation.value);
    assert.equal(evidence.grantsExecutionAuthority, false);
    assert.equal(evidence.treatedAsTradeInstruction, false);
    assert.equal(evidence.providerId, 'fred');
  });

  it('blocks live network in simulation environment', () => {
    assert.throws(() => createMacroProviderRuntime({ mode: 'live' }), /ENVIRONMENT=simulation/);
  });
});
