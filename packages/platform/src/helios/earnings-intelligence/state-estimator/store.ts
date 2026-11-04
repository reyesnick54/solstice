/**
 * In-memory store for expert reliability and conformal residual history.
 */

import { EARNINGS_EXPERT_KINDS } from './taxonomy.ts';
import type { EarningsExpertKind } from './taxonomy.ts';
import type {
  ConformalResidualRecord,
  EarningsCalibrationSnapshot,
  EarningsStateEstimatorStoreSnapshot,
  ExpertReliabilityRecord,
} from './types.ts';
import { defaultExpertReliability } from './reliability.ts';

export type EarningsStateEstimatorStore = {
  snapshot(): EarningsStateEstimatorStoreSnapshot;
  setReliability(expertKind: EarningsExpertKind, record: ExpertReliabilityRecord): void;
  appendConformalResidual(record: ConformalResidualRecord): void;
  appendCalibration(snapshot: EarningsCalibrationSnapshot): void;
};

export function emptyEarningsStateEstimatorStore(): EarningsStateEstimatorStoreSnapshot {
  const reliabilityByExpert = {} as Record<EarningsExpertKind, ExpertReliabilityRecord>;
  for (const expertKind of EARNINGS_EXPERT_KINDS) {
    reliabilityByExpert[expertKind] = defaultExpertReliability(expertKind);
  }
  return Object.freeze({
    reliabilityByExpert: Object.freeze(reliabilityByExpert),
    conformalResiduals: Object.freeze([]),
    calibrationHistory: Object.freeze([]),
  });
}

export function createEarningsStateEstimatorStore(
  initial: EarningsStateEstimatorStoreSnapshot = emptyEarningsStateEstimatorStore(),
): EarningsStateEstimatorStore {
  const reliabilityByExpert = { ...initial.reliabilityByExpert };
  const conformalResiduals = [...initial.conformalResiduals];
  const calibrationHistory = [...initial.calibrationHistory];

  return Object.freeze({
    snapshot: () =>
      Object.freeze({
        reliabilityByExpert: Object.freeze({ ...reliabilityByExpert }),
        conformalResiduals: Object.freeze([...conformalResiduals]),
        calibrationHistory: Object.freeze([...calibrationHistory]),
      }),
    setReliability: (expertKind, record) => {
      reliabilityByExpert[expertKind] = record;
    },
    appendConformalResidual: (record) => {
      conformalResiduals.push(record);
    },
    appendCalibration: (snapshot) => {
      calibrationHistory.push(snapshot);
    },
  });
}
