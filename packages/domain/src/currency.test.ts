import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CANONICAL_SIMULATION_CURRENCIES,
  CURRENCY_REGISTRY,
  majorUnitsToMinorUnits,
  requireCurrencyRecord,
} from './currency.ts';

describe('currency registry', () => {
  it('supports USD EUR GBP SAR AED as simulation currencies with live disabled', () => {
    assert.deepEqual([...CANONICAL_SIMULATION_CURRENCIES], ['USD', 'EUR', 'GBP', 'SAR', 'AED']);
    for (const code of CANONICAL_SIMULATION_CURRENCIES) {
      const record = CURRENCY_REGISTRY[code];
      assert.equal(record.simulationEnabled, true);
      assert.equal(record.liveEnabled, false);
      assert.equal(record.status, 'SUPPORTED_SIMULATION');
      assert.ok(Number.isInteger(record.minorUnitExponent));
    }
  });

  it('scales major units with bigint only', () => {
    assert.equal(majorUnitsToMinorUnits(250n, 'USD'), 25000n);
    assert.equal(majorUnitsToMinorUnits(1n, 'SAR'), 100n);
    assert.equal(requireCurrencyRecord('AED').minorUnitExponent, 2);
  });
});
