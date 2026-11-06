import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_VAL10_UNCERTAINTY_QUALIFIED,
  computeValuationUncertainty,
  evaluateVal10UncertaintyQualification,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';

describe('HELIOS VAL10 uncertainty', () => {
  it('computes dispersion, uncertainty, and fragility', () => {
    const surface = computeValuationUncertainty({
      entityId: 'entity/val10',
      asOf: asUtcInstant('2026-11-01T00:00:00.000Z'),
      evidenceRef: 'ev/test/val10',
      surface: Object.freeze({
        modelMedians: Object.freeze([100, 112, 95, 108]),
        waccShockBps: 80,
        baselineMedian: 100,
        shockedMedian: 91,
      }),
    });
    assert.ok(surface.crossModelDispersion >= 0);
    assert.ok(surface.valuationUncertainty >= 0);
    const qualification = evaluateVal10UncertaintyQualification({
      dispersionMetricPresent: true,
      fragilityMetricPresent: surface.fragility >= 0,
      simulationOnly: true,
    });
    assert.equal(qualification.marker, HELIOS_VAL10_UNCERTAINTY_QUALIFIED);
  });
});
