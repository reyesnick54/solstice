/**
 * HELIOS FORWARD ALPHA — ALPHA10 forward regime robustness engine.
 *
 * Extends EVOL10 analysis for forward (shadow / paper) performance only.
 * Regime tags must be knowable at decision time; no future regime labels.
 */

import type { UtcInstant } from '@solstice/domain';

import {
  computeCrossRegimeRobustness,
  computeGeneralizationScoreBps,
  computeRegimeConcentrationBps,
  computeStressRegimeAssessment,
  computeWorstRegimePerformance,
  evaluateEvol10GenomeRegimeReport,
  type RegimePerformanceMatrix,
} from '../evol10/regime-generalization.ts';
import type { HeliosEvol10RegimeDimension } from './taxonomy.ts';
import type { Alpha10CampaignRegimeDeclaration, ForwardRegimeScopeSlice } from './taxonomy.ts';
import { EMPTY_FORWARD_REGIME_SCOPE, scopeSliceKey } from './taxonomy.ts';

export const HELIOS_ALPHA10_FORWARD_GENERALIZATION_QUALIFIED =
  'HELIOS_ALPHA10_FORWARD_GENERALIZATION_QUALIFIED' as const;

export const HELIOS_ALPHA10_FORWARD_GENERALIZATION_BLOCKED =
  'HELIOS_ALPHA10_FORWARD_GENERALIZATION_BLOCKED' as const;

export type ForwardRegimeMatrixCell = {
  readonly strategyId: string;
  readonly regimeDimension: HeliosEvol10RegimeDimension;
  readonly scope: ForwardRegimeScopeSlice;
  readonly forwardDecisionCount: number;
  readonly forwardReturnMinor: bigint;
};

/** Forward performance by regime (and scope slice) — research P&L proxy in minor units. */
export type ForwardRegimeMatrix = {
  readonly methodologyVersion: 'helios-alpha10-forward-regime-matrix-v1';
  readonly cells: readonly ForwardRegimeMatrixCell[];
};

export type RegimeConcentration = {
  readonly methodologyVersion: 'helios-alpha10-regime-concentration-v1';
  readonly strategyId: string;
  readonly concentrationBps: bigint;
  readonly dominantRegime: HeliosEvol10RegimeDimension | null;
};

export type RegimeTransitionPerformance = {
  readonly methodologyVersion: 'helios-alpha10-regime-transition-v1';
  readonly strategyId: string;
  readonly transitionCount: number;
  readonly transitionReturnMinor: bigint;
};

/**
 * One forward decision bar with PIT regime labels and scope attribution.
 * `strategyActive` is false when regime gating kept the strategy inactive.
 */
export type ForwardRegimePerformanceObservation = {
  readonly strategyId: string;
  readonly decisionTime: UtcInstant;
  readonly forwardReturnMinor: bigint;
  readonly regimeDimensions: readonly HeliosEvol10RegimeDimension[];
  readonly scope: ForwardRegimeScopeSlice;
  readonly strategyActive: boolean;
  readonly isRegimeTransitionBar?: boolean;
};

export type Alpha10ForwardRegimeReport = {
  readonly strategyId: string;
  readonly matrix: ForwardRegimeMatrix;
  readonly regimeConcentration: RegimeConcentration;
  readonly regimeTransitionPerformance: RegimeTransitionPerformance;
  readonly crossScopeMatrices: readonly ForwardRegimeMatrix[];
  readonly evol10Aligned: ReturnType<typeof evaluateEvol10GenomeRegimeReport>;
  readonly nicheExceptionApplied: boolean;
  readonly retrospectiveSpecialistBlocked: boolean;
  readonly inactiveOutsideIntendedRegime: boolean;
  readonly generalizationScoreBps: bigint;
};

function cellsForStrategy(matrix: ForwardRegimeMatrix, strategyId: string): readonly ForwardRegimeMatrixCell[] {
  return matrix.cells.filter((c) => c.strategyId === strategyId);
}

function toEvol10Matrix(matrix: ForwardRegimeMatrix, strategyId: string): RegimePerformanceMatrix {
  const cells = cellsForStrategy(matrix, strategyId);
  const byRegime = new Map<HeliosEvol10RegimeDimension, { count: number; ret: bigint }>();
  for (const c of cells) {
    const prev = byRegime.get(c.regimeDimension) ?? { count: 0, ret: 0n };
    byRegime.set(c.regimeDimension, {
      count: prev.count + c.forwardDecisionCount,
      ret: prev.ret + c.forwardReturnMinor,
    });
  }
  return Object.freeze({
    methodologyVersion: 'helios-evol10-regime-matrix-v1',
    cells: Object.freeze(
      [...byRegime.entries()].map(([regimeDimension, agg]) =>
        Object.freeze({
          genomeId: strategyId,
          regimeDimension,
          observationCount: agg.count,
          totalReturnMinor: agg.ret,
        }),
      ),
    ),
  });
}

export function buildForwardRegimeMatrix(
  observations: readonly ForwardRegimePerformanceObservation[],
): ForwardRegimeMatrix {
  const bucket = new Map<string, ForwardRegimeMatrixCell>();
  for (const obs of observations) {
    if (!obs.strategyActive) {
      continue;
    }
    for (const regimeDimension of obs.regimeDimensions) {
      const key = `${obs.strategyId}\0${regimeDimension}\0${scopeSliceKey(obs.scope)}`;
      const prev = bucket.get(key);
      if (prev === undefined) {
        bucket.set(
          key,
          Object.freeze({
            strategyId: obs.strategyId,
            regimeDimension,
            scope: obs.scope,
            forwardDecisionCount: 1,
            forwardReturnMinor: obs.forwardReturnMinor,
          }),
        );
      } else {
        bucket.set(
          key,
          Object.freeze({
            ...prev,
            forwardDecisionCount: prev.forwardDecisionCount + 1,
            forwardReturnMinor: prev.forwardReturnMinor + obs.forwardReturnMinor,
          }),
        );
      }
    }
  }
  return Object.freeze({
    methodologyVersion: 'helios-alpha10-forward-regime-matrix-v1',
    cells: Object.freeze([...bucket.values()]),
  });
}

export function buildScopeSlicedForwardMatrices(
  observations: readonly ForwardRegimePerformanceObservation[],
  axis: keyof ForwardRegimeScopeSlice,
): ForwardRegimeMatrix {
  const scoped: ForwardRegimePerformanceObservation[] = [];
  for (const obs of observations) {
    const value = obs.scope[axis];
    if (value === null || value === undefined) {
      continue;
    }
    scoped.push(
      Object.freeze({
        ...obs,
        scope: Object.freeze({
          ...EMPTY_FORWARD_REGIME_SCOPE,
          [axis]: value,
        }) as ForwardRegimeScopeSlice,
      }),
    );
  }
  return buildForwardRegimeMatrix(scoped);
}

export function computeForwardRegimeConcentration(
  matrix: ForwardRegimeMatrix,
  strategyId: string,
): RegimeConcentration {
  const evol10 = toEvol10Matrix(matrix, strategyId);
  const concentrationBps = computeRegimeConcentrationBps(evol10, strategyId);
  const cells = cellsForStrategy(matrix, strategyId);
  let dominant: HeliosEvol10RegimeDimension | null = null;
  let maxAbs = 0n;
  const byRegime = new Map<HeliosEvol10RegimeDimension, bigint>();
  for (const c of cells) {
    const prev = byRegime.get(c.regimeDimension) ?? 0n;
    byRegime.set(c.regimeDimension, prev + c.forwardReturnMinor);
  }
  for (const [regime, ret] of byRegime) {
    const a = ret >= 0n ? ret : -ret;
    if (a > maxAbs) {
      maxAbs = a;
      dominant = regime;
    }
  }
  return Object.freeze({
    methodologyVersion: 'helios-alpha10-regime-concentration-v1',
    strategyId,
    concentrationBps,
    dominantRegime: dominant,
  });
}

export function computeForwardRegimeTransitionPerformance(
  observations: readonly ForwardRegimePerformanceObservation[],
  strategyId: string,
): RegimeTransitionPerformance {
  let transitionCount = 0;
  let transitionReturnMinor = 0n;
  for (const obs of observations) {
    if (obs.strategyId !== strategyId || !obs.strategyActive) {
      continue;
    }
    if (obs.isRegimeTransitionBar === true) {
      transitionCount += 1;
      transitionReturnMinor += obs.forwardReturnMinor;
    }
  }
  return Object.freeze({
    methodologyVersion: 'helios-alpha10-regime-transition-v1',
    strategyId,
    transitionCount,
    transitionReturnMinor,
  });
}

function specialistInactiveOutsideIntended(input: {
  readonly observations: readonly ForwardRegimePerformanceObservation[];
  readonly strategyId: string;
  readonly intendedRegimes: readonly HeliosEvol10RegimeDimension[];
}): boolean {
  const intended = new Set(input.intendedRegimes);
  for (const obs of input.observations) {
    if (obs.strategyId !== input.strategyId) {
      continue;
    }
    const inIntended = obs.regimeDimensions.some((d) => intended.has(d));
    if (!inIntended && obs.strategyActive && obs.forwardReturnMinor !== 0n) {
      return false;
    }
  }
  return true;
}

export function evaluateAlpha10ForwardRegimeReport(input: {
  readonly strategyId: string;
  readonly observations: readonly ForwardRegimePerformanceObservation[];
  readonly campaignDeclaration: Alpha10CampaignRegimeDeclaration;
  readonly campaignStartedAt: UtcInstant;
  readonly meanReturnScaleMinor?: bigint;
  readonly transitionReturnFromObservations?: boolean;
}): Alpha10ForwardRegimeReport {
  const matrix = buildForwardRegimeMatrix(input.observations);
  const concentration = computeForwardRegimeConcentration(matrix, input.strategyId);
  const transition = computeForwardRegimeTransitionPerformance(input.observations, input.strategyId);

  const crossScopeMatrices = Object.freeze([
    buildScopeSlicedForwardMatrices(input.observations, 'assetClass'),
    buildScopeSlicedForwardMatrices(input.observations, 'sector'),
    buildScopeSlicedForwardMatrices(input.observations, 'market'),
    buildScopeSlicedForwardMatrices(input.observations, 'venue'),
    buildScopeSlicedForwardMatrices(input.observations, 'geography'),
  ]);

  const declaredBeforeCampaign =
    Date.parse(input.campaignDeclaration.declaredAt) <= Date.parse(input.campaignStartedAt);

  const retrospectiveSpecialistBlocked =
    input.campaignDeclaration.regimeSpecialist &&
    (!declaredBeforeCampaign ||
      input.campaignDeclaration.intendedRegimes.length === 0);

  const specialistActive =
    input.campaignDeclaration.regimeSpecialist &&
    declaredBeforeCampaign &&
    input.campaignDeclaration.intendedRegimes.length > 0;

  const inactiveOutsideIntendedRegime = specialistActive
    ? specialistInactiveOutsideIntended({
        observations: input.observations,
        strategyId: input.strategyId,
        intendedRegimes: input.campaignDeclaration.intendedRegimes,
      })
    : true;

  const evol10Matrix = toEvol10Matrix(matrix, input.strategyId);
  const evol10Aligned = evaluateEvol10GenomeRegimeReport({
    matrix: evol10Matrix,
    genomeId: input.strategyId,
    regimeSpecialistDeclared: specialistActive,
    regimeSpecialistGated: specialistActive && inactiveOutsideIntendedRegime,
    transition: input.transitionReturnFromObservations
      ? {
          transitionCount: transition.transitionCount,
          transitionReturnMinor: transition.transitionReturnMinor,
        }
      : undefined,
    meanReturnScaleMinor: input.meanReturnScaleMinor,
  });

  const robust = computeCrossRegimeRobustness(evol10Matrix, input.strategyId);
  const worst = computeWorstRegimePerformance(evol10Matrix, input.strategyId);
  const score = computeGeneralizationScoreBps({
    meanReturnMinor: robust.meanReturnMinor,
    crossRegimeStdevMinor: robust.crossRegimeStdevMinor,
    worstReturnMinor: worst.totalReturnMinor,
    meanReturnScaleMinor: input.meanReturnScaleMinor ?? 1_000_000n,
    regimeSpecialistDeclared: evol10Aligned.nicheExceptionApplied,
  });

  return Object.freeze({
    strategyId: input.strategyId,
    matrix,
    regimeConcentration: concentration,
    regimeTransitionPerformance: transition,
    crossScopeMatrices,
    evol10Aligned,
    nicheExceptionApplied: evol10Aligned.nicheExceptionApplied,
    retrospectiveSpecialistBlocked,
    inactiveOutsideIntendedRegime,
    generalizationScoreBps: score,
  });
}

export function evaluateAlpha10ForwardGeneralizationQualification(input: {
  readonly report: Alpha10ForwardRegimeReport;
  readonly campaignDeclaration: Alpha10CampaignRegimeDeclaration;
  readonly minGeneralizationScoreBps?: bigint;
  readonly minWorstRegimeReturnMinor?: bigint;
  readonly maxConcentrationBps?: bigint;
}): {
  readonly qualified: boolean;
  readonly token:
    | typeof HELIOS_ALPHA10_FORWARD_GENERALIZATION_QUALIFIED
    | typeof HELIOS_ALPHA10_FORWARD_GENERALIZATION_BLOCKED;
  readonly blockers: readonly string[];
} {
  const blockers: string[] = [];
  const minScore = input.minGeneralizationScoreBps ?? -500_000n;
  const minWorst = input.minWorstRegimeReturnMinor ?? -2_000_000n;
  const maxConc = input.maxConcentrationBps ?? 9_500n;

  if (input.report.retrospectiveSpecialistBlocked) {
    blockers.push('RETROSPECTIVE_REGIME_SPECIALIST_CLAIM');
  }

  if (
    input.campaignDeclaration.regimeSpecialist &&
    !input.report.inactiveOutsideIntendedRegime
  ) {
    blockers.push('ACTIVE_OUTSIDE_DECLARED_REGIME');
  }

  const isSpecialist =
    input.campaignDeclaration.regimeSpecialist && input.report.nicheExceptionApplied;

  if (!isSpecialist && input.report.regimeConcentration.concentrationBps > maxConc) {
    blockers.push('REGIME_CONCENTRATION_EXCESSIVE');
  }

  const mandate = input.campaignDeclaration.regimeSpecialist
    ? input.campaignDeclaration.intendedRegimes
    : input.campaignDeclaration.mandateRegimes;

  const presentRegimes = new Set(
    input.report.matrix.cells
      .filter((c) => c.strategyId === input.report.strategyId)
      .map((c) => c.regimeDimension),
  );
  for (const required of mandate) {
    if (!presentRegimes.has(required)) {
      blockers.push(`MANDATE_REGIME_MISSING:${required}`);
    }
  }

  const okScore = input.report.generalizationScoreBps >= minScore;
  const okTail = input.report.evol10Aligned.worstRegimePerformance.totalReturnMinor >= minWorst;

  if (!okScore && !isSpecialist) {
    blockers.push('GENERALIZATION_SCORE_BELOW_FLOOR');
  }
  if (!okTail) {
    blockers.push('WORST_REGIME_FORWARD_RETURN_BELOW_FLOOR');
  }

  const specialistOk =
    isSpecialist && okTail && input.report.inactiveOutsideIntendedRegime;

  const generalistOk = !input.campaignDeclaration.regimeSpecialist && okScore && okTail;

  const qualified =
    !input.report.retrospectiveSpecialistBlocked &&
    blockers.length === 0 &&
    (generalistOk || specialistOk);

  return Object.freeze({
    qualified,
    token: qualified
      ? HELIOS_ALPHA10_FORWARD_GENERALIZATION_QUALIFIED
      : HELIOS_ALPHA10_FORWARD_GENERALIZATION_BLOCKED,
    blockers: Object.freeze(blockers),
  });
}

/** Stress slice for forward windows (reuses EVOL10 stress tags). */
export function computeForwardStressRegimeAssessment(
  matrix: ForwardRegimeMatrix,
  strategyId: string,
): ReturnType<typeof computeStressRegimeAssessment> {
  return computeStressRegimeAssessment(toEvol10Matrix(matrix, strategyId), strategyId);
}
