import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createExternalDataPlane } from '../packages/external-data/src/index.ts';
import { createWorldExternalDataBff } from '../services/api/src/consumer/world-external-data-adapter.ts';

describe('Wave 2 BFF external data adapter', () => {
  it('exposes vendor-independent world economy and filings resources', () => {
    const bff = createWorldExternalDataBff(createExternalDataPlane());
    const economy = bff.economy();
    const fx = bff.fx();
    const markets = bff.markets();
    const filings = bff.filings();
    assert.equal(economy.schema, 'sunrey.world.economy.v1');
    assert.equal(fx.schema, 'sunrey.bff.fx-reference.v1');
    assert.equal(markets.schema, 'sunrey.bff.market-reference.v1');
    assert.equal(filings.schema, 'sunrey.bff.company-filings.v1');
    assert.ok(filings.filings.length > 0);
    assert.equal(JSON.stringify(bff).includes('FRED_API_KEY'), false);
  });

  it('surfaces provider coverage for operators', () => {
    const bff = createWorldExternalDataBff(createExternalDataPlane());
    const coverage = bff.coverage();
    assert.equal(coverage.implemented, 17);
    assert.ok(bff.providerHealth().length > 0);
  });
});
