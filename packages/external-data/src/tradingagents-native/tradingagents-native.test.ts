import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asOf, normalizeSymbol } from './index.ts';

describe('tradingagents-native dataflow', () => {
  it('normalizes metals symbols', () => {
    assert.equal(normalizeSymbol('XAUUSD+'), 'GC=F');
  });

  it('clamps as-of to trade date', () => {
    assert.equal(asOf('2025-01-01', '2024-06-01'), '2024-06-01');
  });
});
