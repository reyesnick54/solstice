import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FIXTURE_VAL08_AS_OF,
  HELIOS_VAL08_COMPARABLES_QUALIFIED,
  evaluateVal08ComparablesQualification,
  fixtureVal08Peers,
  runProbabilisticComparables,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';

describe('HELIOS VAL08 comparables', () => {
  it('values target from peer multiple distribution', () => {
    const result = runProbabilisticComparables({
      entityId: 'entity/val08',
      asOf: FIXTURE_VAL08_AS_OF,
      targetEbitda: 12_000,
      netDebt: 500,
      sharesOutstanding: 100,
      peers: fixtureVal08Peers(FIXTURE_VAL08_AS_OF),
      evidenceRef: 'ev/test/val08',
    });
    assert.ok(result.impliedValuePerShare.median > 0);
    const qualification = evaluateVal08ComparablesQualification({
      peerDistributionPresent: result.peerCount >= 3,
      pointInTimePeers: true,
      simulationOnly: true,
    });
    assert.equal(qualification.marker, HELIOS_VAL08_COMPARABLES_QUALIFIED);
  });
});
