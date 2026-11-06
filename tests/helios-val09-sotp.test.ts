import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FIXTURE_VAL09_AS_OF,
  HELIOS_VAL09_SOTP_QUALIFIED,
  evaluateVal09SotpQualification,
  fixtureVal09Segments,
  runSotpValuation,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';

describe('HELIOS VAL09 SOTP', () => {
  it('aggregates segment distributions with holding-company discount', () => {
    const result = runSotpValuation({
      entityId: 'entity/val09',
      asOf: FIXTURE_VAL09_AS_OF,
      segments: fixtureVal09Segments(),
      holdingCompanyDiscountBps: 150,
      evidenceRef: 'ev/test/val09',
    });
    assert.ok(result.consolidatedValuePerShare.median > 0);
    assert.ok(Object.keys(result.segmentValuePerShare).length >= 2);
    const qualification = evaluateVal09SotpQualification({
      segmentBreakdownPresent: true,
      simulationOnly: true,
    });
    assert.equal(qualification.marker, HELIOS_VAL09_SOTP_QUALIFIED);
  });
});
