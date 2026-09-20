import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateMultiAssetInstrumentDomainQualification,
  HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED,
  MULTI_ASSET_CLASSES,
  resolveMultiAssetInstrument,
  searchMultiAssetInstruments,
} from '../packages/sunrey-exchange/src/capital-market/multi-asset/index.ts';

describe('HELIOS M01 multi-asset instrument domain qualification', () => {
  it('registers the initial engineering universe', () => {
    const required = [
      'SECURITY:US:AAPL:XNAS',
      'SECURITY:US:SPY:ARCX',
      'SECURITY:US:QQQ:XNAS',
      'CRYPTO:GLOBAL:BTC:USD:SIM',
      'CRYPTO:GLOBAL:ETH:USD:SIM',
      'COMMODITY:GLOBAL:GOLD:XCEC',
      'COMMODITY:GLOBAL:WTI:XNYM',
      'FX:GLOBAL:EUR:USD:SIM',
      'FX:GLOBAL:USD:JPY:SIM',
    ] as const;

    for (const instrumentId of required) {
      const row = resolveMultiAssetInstrument(instrumentId);
      assert.ok(row, `missing ${instrumentId}`);
      assert.equal(row.metadataAuthority === 'REFERENCE_ONLY' || row.metadataAuthority === 'SANDBOX', true);
      assert.equal(row.capability.execution, 'NONE');
    }
  });

  it('supports every required asset class', () => {
    for (const assetClass of MULTI_ASSET_CLASSES) {
      const rows = searchMultiAssetInstruments({ assetClass, limit: 5 });
      assert.ok(rows.length > 0, assetClass);
    }
  });

  it('qualifies with HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED', () => {
    const result = evaluateMultiAssetInstrumentDomainQualification();
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M01_INSTRUMENT_DOMAIN_QUALIFIED, result.blockers.join('; '));
  });
});
