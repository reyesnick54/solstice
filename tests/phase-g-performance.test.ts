import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { measurePhaseGPerformance } from '../packages/sunrey-exchange/src/productization/performance.ts';

describe('Phase G performance / load baseline', () => {
  it('records non-production methodology without inventing an SLA', () => {
    const report = measurePhaseGPerformance();
    assert.equal(report.productionSlaClaimed, false);
    assert.equal(report.productionSlaInvented, false);
    assert.ok(report.samples.some((row) => row.name === 'market_list' && row.elapsedMs >= 0));
    writeFileSync('docs/productization/phase-g-performance-baseline.json', `${JSON.stringify(report, null, 2)}\n`);
  });
});
