import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matchSkuEntity, alt06DemoSkus, assertPermittedProductDemandSource } from './index.ts';

describe('ALT06 external-data product demand', () => {
  it('permits licensed API sources only', () => {
    const row = alt06DemoSkus()[0]!;
    assert.equal(assertPermittedProductDemandSource(row.provenance.provider).permitted, true);
  });

  it('matches GTIN deterministically', () => {
    const match = matchSkuEntity({
      catalog: alt06DemoSkus(),
      queryIdentifiers: [{ kind: 'gtin', value: '00012345678905' }],
    });
    assert.equal(match.confidence, 'deterministic');
  });
});
