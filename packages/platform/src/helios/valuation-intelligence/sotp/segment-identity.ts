/**
 * Temporal segment identity — bind SEC segment observations without rewriting history.
 */

import type { SegmentObservation } from '@solstice/external-data';
import type { UtcInstant } from '@solstice/domain';
import type { BusinessSegment, SegmentEconomicProfile, SegmentIdentityBinding } from './types.ts';
import type { SegmentLifecycleEventKind } from './taxonomy.ts';

const REVENUE_CONCEPTS = Object.freeze(
  new Set(['Revenues', 'SalesRevenueNet', 'RevenueFromContractWithCustomerExcludingAssessedTax']),
);

export function filterKnowableSegmentObservations(
  observations: readonly SegmentObservation[],
  evaluationTimeUtc: UtcInstant,
): readonly SegmentObservation[] {
  const evalMs = Date.parse(evaluationTimeUtc);
  if (!Number.isFinite(evalMs)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    observations.filter((obs) => {
      const knowMs = Date.parse(obs.knowableAt);
      return Number.isFinite(knowMs) && knowMs <= evalMs;
    }),
  );
}

type IdentityRow = {
  readonly stableSegmentKey: string;
  readonly binding: SegmentIdentityBinding;
};

/**
 * Assign stable keys from filing-time segment ids. Renames create a new binding
 * linked via priorStableSegmentKey when the issuer reuses segmentId with a new label.
 */
export function bindSegmentIdentities(
  observations: readonly SegmentObservation[],
): readonly BusinessSegment[] {
  const byStableKey = new Map<string, IdentityRow[]>();
  const labelBySegmentId = new Map<string, string>();

  const sorted = [...observations].sort((a, b) => {
    const ka = Date.parse(a.knowableAt);
    const kb = Date.parse(b.knowableAt);
    if (ka !== kb) return ka - kb;
    return a.filingId.localeCompare(b.filingId);
  });

  for (const obs of sorted) {
    const priorLabel = labelBySegmentId.get(obs.segmentId);
    let eventKind: SegmentLifecycleEventKind = 'REPORTED';
    let priorStableKey: string | null = null;

    if (priorLabel !== undefined && priorLabel !== obs.segmentLabel) {
      eventKind = 'RENAMED';
      priorStableKey = `seg:${obs.segmentId}:${priorLabel}`;
    } else if (priorLabel === undefined) {
      eventKind = 'REPORTED';
    } else {
      eventKind = 'REPORTED';
    }

    labelBySegmentId.set(obs.segmentId, obs.segmentLabel);

    const stableSegmentKey =
      eventKind === 'RENAMED' && priorStableKey
        ? `seg:${obs.segmentId}:${obs.segmentLabel}:${obs.fiscalPeriod}`
        : `seg:${obs.segmentId}:${obs.segmentLabel}`;

    const binding: SegmentIdentityBinding = Object.freeze({
      stableSegmentKey,
      reportedSegmentId: obs.segmentId,
      reportedLabel: obs.segmentLabel,
      fiscalPeriod: obs.fiscalPeriod,
      knowableAt: obs.knowableAt,
      filingId: obs.filingId,
      eventKind,
      priorStableSegmentKey: priorStableKey,
      evidenceRef: obs.evidenceRef,
    });

    const rows = byStableKey.get(stableSegmentKey) ?? [];
    rows.push(Object.freeze({ stableSegmentKey, binding }));
    byStableKey.set(stableSegmentKey, rows);
  }

  const segments: BusinessSegment[] = [];
  for (const [stableSegmentKey, rows] of byStableKey) {
    const history = Object.freeze(rows.map((row) => row.binding));
    const last = history[history.length - 1]!;
    segments.push(
      Object.freeze({
        stableSegmentKey,
        displayLabel: last.reportedLabel,
        activeAsOf: history[0]!.knowableAt,
        retiredAt: null,
        identityHistory: history,
        grantsExecutionAuthority: false,
      }),
    );
  }

  return Object.freeze(segments.sort((a, b) => a.stableSegmentKey.localeCompare(b.stableSegmentKey)));
}

export function segmentProfilesFromObservations(
  observations: readonly SegmentObservation[],
  stableSegmentKeyFor: (obs: SegmentObservation) => string,
): readonly SegmentEconomicProfile[] {
  const latestByKey = new Map<string, SegmentEconomicProfile>();

  for (const obs of observations) {
    const key = stableSegmentKeyFor(obs);
    const existing = latestByKey.get(key);
    const knowMs = Date.parse(obs.knowableAt);
    if (existing) {
      const existingMs = Date.parse(existing.knowableAt);
      if (knowMs < existingMs) {
        continue;
      }
    }

    const profile: SegmentEconomicProfile = Object.freeze({
      stableSegmentKey: key,
      fiscalPeriod: obs.fiscalPeriod,
      revenueMinor: REVENUE_CONCEPTS.has(obs.metricConcept) ? obs.valueMinor : existing?.revenueMinor ?? null,
      operatingIncomeMinor: obs.metricConcept.includes('OperatingIncome')
        ? obs.valueMinor
        : existing?.operatingIncomeMinor ?? null,
      assetsMinor: obs.metricConcept.includes('Assets') ? obs.valueMinor : existing?.assetsMinor ?? null,
      capexMinor: obs.metricConcept.includes('CapitalExpenditure') ? obs.valueMinor : existing?.capexMinor ?? null,
      currency: 'USD',
      knowableAt: obs.knowableAt,
      sourceObservationRefs: Object.freeze([obs.evidenceRef]),
    });
    latestByKey.set(key, profile);
  }

  return Object.freeze([...latestByKey.values()]);
}

export function resolveStableKeyAtEvaluation(
  segments: readonly BusinessSegment[],
  reportedSegmentId: string,
  reportedLabel: string,
): string | null {
  const match = segments.find(
    (seg) =>
      seg.displayLabel === reportedLabel &&
      seg.identityHistory.some((row) => row.reportedSegmentId === reportedSegmentId),
  );
  return match?.stableSegmentKey ?? null;
}
