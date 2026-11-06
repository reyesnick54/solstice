import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_VAL11_ADAPTIVE_ENSEMBLE_QUALIFIED,
  evaluateVal11AdaptiveEnsembleQualification,
  runAdaptiveEnsemble,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';

describe('HELIOS VAL11 adaptive ensemble', () => {
  it('weights models by applicability and blends distributions', () => {
    const samplesA = Object.freeze([10, 11, 12, 13]);
    const samplesB = Object.freeze([8, 9, 10, 11]);
    const result = runAdaptiveEnsemble({
      entityId: 'entity/val11',
      asOf: asUtcInstant('2026-11-01T00:00:00.000Z'),
      evidenceRef: 'ev/test/val11',
      models: Object.freeze([
        Object.freeze({
          method: 'DCF_FCFF' as const,
          applicabilityScore: 0.9,
          valuePerShareSamples: samplesA,
        }),
        Object.freeze({
          method: 'COMPARABLE_MULTIPLES' as const,
          applicabilityScore: 0.6,
          valuePerShareSamples: samplesB,
        }),
      ]),
    });
    assert.ok((result.modelWeights.DCF_FCFF ?? 0) > (result.modelWeights.COMPARABLE_MULTIPLES ?? 0));
    const qualification = evaluateVal11AdaptiveEnsembleQualification({
      adaptiveWeights: true,
      applicabilityGating: true,
      simulationOnly: true,
    });
    assert.equal(qualification.marker, HELIOS_VAL11_ADAPTIVE_ENSEMBLE_QUALIFIED);
  });
});
