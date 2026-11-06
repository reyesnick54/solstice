import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FIXTURE_VAL07_AS_OF,
  FIXTURE_VAL07_ENTITY,
  HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED,
  evaluateVal07ResidualIncomeQualification,
  fixtureVal07Paths,
  runResidualIncomeEngine,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';

describe('HELIOS VAL07 residual income', () => {
  it('produces probabilistic per-share RIV distribution', () => {
    const result = runResidualIncomeEngine({
      entityId: FIXTURE_VAL07_ENTITY,
      asOf: FIXTURE_VAL07_AS_OF,
      paths: fixtureVal07Paths(),
      evidenceRef: 'ev/test/val07',
    });
    assert.ok(result.valuePerShare.median > 0);
    assert.equal(result.grantsExecutionAuthority, false);
    const qualification = evaluateVal07ResidualIncomeQualification({
      economicProfitModeled: true,
      distributionPresent: result.pathCount > 0,
      simulationOnly: true,
    });
    assert.equal(qualification.marker, HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED);
  });
});
