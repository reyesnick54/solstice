/**
 * Compile PointInTimeEarningsEventSnapshot — only information knowable at decision time T.
 */

import type { UtcInstant } from '@solstice/domain';
import type { EarningsSessionTiming } from '@solstice/external-data';
import type { EarningsExternalObservation } from '@solstice/external-data';
import {
  selectKnowableRevisionAt,
  type RevisionLedgerStore,
} from '../../feature-fabric/revision-ledger/store.ts';
import type { EarningsEventGraphStore } from './store.ts';
import { filterKnowable, isKnowableAt } from './temporal.ts';
import type { CompilePointInTimeSnapshotInput, EarningsEventTimeView, PointInTimeEarningsEventSnapshot } from './types.ts';
import { HELIOS_EARNINGS_EVENT_GRAPH_SCHEMA } from './taxonomy.ts';

function mergeTimes(
  observations: readonly EarningsExternalObservation[],
  decisionTimeUtc: UtcInstant,
): EarningsEventTimeView {
  const pickLatest = (
    field: keyof EarningsExternalObservation['times'],
  ): UtcInstant | null => {
    let best: UtcInstant | null = null;
    let bestMs = -1;
    for (const row of observations) {
      const value = row.times[field];
      if (value === null || !isKnowableAt(row.times.knowableAt, decisionTimeUtc)) {
        continue;
      }
      const ms = Date.parse(value);
      if (Number.isFinite(ms) && ms >= bestMs) {
        bestMs = ms;
        best = value;
      }
    }
    return best;
  };

  return Object.freeze({
    scheduledEventTime: pickLatest('scheduledEventTime'),
    confirmedEventTime: pickLatest('confirmedEventTime'),
    actualReleaseTime: pickLatest('actualReleaseTime'),
    secAcceptedTime: pickLatest('secAcceptedTime'),
    callStartTime: pickLatest('callStartTime'),
    providerAvailabilityTime: pickLatest('providerAvailabilityTime'),
    sunreyArrivalTime: pickLatest('sunreyArrivalTime'),
    knowableAt: pickLatest('knowableAt'),
  });
}

function resolveSessionTiming(
  observations: readonly EarningsExternalObservation[],
  decisionTimeUtc: UtcInstant,
): EarningsSessionTiming {
  const releaseObs = observations
    .filter(
      (row) =>
        isKnowableAt(row.times.knowableAt, decisionTimeUtc) &&
        (row.artifactKind === 'EARNINGS_RELEASE' || row.artifactKind === 'SEC_8K_2_02'),
    )
    .sort((a, b) => Date.parse(b.times.knowableAt) - Date.parse(a.times.knowableAt));
  return releaseObs[0]?.sessionTiming ?? 'UNKNOWN';
}

function resolveRescheduleLineage(
  observations: readonly EarningsExternalObservation[],
  decisionTimeUtc: UtcInstant,
): string | null {
  for (const row of observations) {
    if (row.rescheduledFromEventKey && isKnowableAt(row.times.knowableAt, decisionTimeUtc)) {
      return row.rescheduledFromEventKey;
    }
  }
  return null;
}

export function compilePointInTimeEarningsEventSnapshot(
  store: EarningsEventGraphStore,
  revisionLedger: RevisionLedgerStore,
  input: CompilePointInTimeSnapshotInput,
): PointInTimeEarningsEventSnapshot | null {
  const decisionTimeUtc = input.decisionTimeUtc;
  const observations = store
    .listObservations()
    .map((row) => row.observation)
    .filter(
      (row) =>
        row.earningsEventKey === input.earningsEventKey &&
        isKnowableAt(row.times.knowableAt, decisionTimeUtc),
    );

  if (observations.length === 0) {
    return null;
  }

  const fiscal = observations[0]!.fiscal;
  const canonicalEntityId = observations[0]!.canonicalEntityId;
  const nodes = filterKnowable(
    store.listNodes().filter((row) => row.earningsEventKey === input.earningsEventKey),
    decisionTimeUtc,
  );
  const edges = filterKnowable(
    store.listEdges().filter((row) => {
      const from = store.listNodes().find((n) => n.nodeId === row.fromNodeId);
      return from?.earningsEventKey === input.earningsEventKey;
    }),
    decisionTimeUtc,
  );

  const revisionChainIds = [...new Set(observations.map((row) => row.lineageRootId))];
  const policy = input.revisionPolicy ?? 'LATEST_KNOWABLE_REVISION';
  for (const chainId of revisionChainIds) {
    const chain = revisionLedger.listChain(chainId);
    if (chain.length > 0) {
      selectKnowableRevisionAt(chain, decisionTimeUtc, policy);
    }
  }

  return Object.freeze({
    schema: HELIOS_EARNINGS_EVENT_GRAPH_SCHEMA,
    decisionTimeUtc,
    earningsEventKey: input.earningsEventKey,
    canonicalEntityId,
    fiscal,
    times: mergeTimes(observations, decisionTimeUtc),
    sessionTiming: resolveSessionTiming(observations, decisionTimeUtc),
    nodes,
    edges,
    revisionChainIds: Object.freeze(revisionChainIds),
    rescheduledFromEventKey: resolveRescheduleLineage(observations, decisionTimeUtc),
    grantsExecutionAuthority: false,
  });
}

export function assertNoFutureEarningsLeak(input: {
  readonly decisionTimeUtc: UtcInstant;
  readonly snapshot: PointInTimeEarningsEventSnapshot;
}): { readonly ok: boolean; readonly reason: string | null } {
  const decisionMs = Date.parse(input.decisionTimeUtc);
  for (const row of input.snapshot.nodes) {
    if (Date.parse(row.knowableAt) > decisionMs) {
      return Object.freeze({ ok: false, reason: `FUTURE_NODE:${row.nodeId}` });
    }
  }
  if (input.snapshot.times.actualReleaseTime !== null) {
    const releaseMs = Date.parse(input.snapshot.times.actualReleaseTime);
    if (Number.isFinite(releaseMs) && releaseMs > decisionMs) {
      return Object.freeze({ ok: false, reason: 'FUTURE_RELEASE_TIME' });
    }
  }
  return Object.freeze({ ok: true, reason: null });
}
