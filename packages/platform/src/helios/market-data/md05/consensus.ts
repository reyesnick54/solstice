/**
 * Provider consensus — select a single truthful observation; never average incompatible inputs.
 */

import type { UtcInstant } from '@solstice/domain';
import { economicallyEquivalent, listDivergenceFields } from './compatibility.ts';
import type { FeedReplicaRole } from './taxonomy.ts';
import { HELIOS_MD05_SCHEMA } from './taxonomy.ts';
import type {
  FeedDivergence,
  InboundMarketTick,
  MarketObservationConsensus,
  MarketSourceAttribution,
  NormalizedMarketObservation,
  ProviderTrustState,
} from './types.ts';
import { compareProviderTrust } from './trust.ts';

const ROLE_PRIORITY: Readonly<Record<FeedReplicaRole, number>> = Object.freeze({
  PRIMARY_A: 50,
  PRIMARY_B: 49,
  DIRECT_VENUE: 40,
  SIP_OR_CONSOLIDATED: 35,
  SECONDARY_VENDOR: 20,
});

export function buildMarketObservationConsensus(input: {
  readonly symbol: string;
  readonly venueId: string;
  readonly ticks: readonly InboundMarketTick[];
  readonly trustByProvider: Readonly<Record<string, ProviderTrustState>>;
  readonly decidedAt: UtcInstant;
  readonly dedupeAttribution: readonly MarketSourceAttribution[];
}): MarketObservationConsensus {
  const divergences: FeedDivergence[] = [];
  const uniqueTicks = dedupeByMessageIdentity(input.ticks);

  if (uniqueTicks.length === 0) {
    return Object.freeze({
      schema: HELIOS_MD05_SCHEMA,
      symbol: input.symbol,
      venueId: input.venueId,
      outcome: 'INSUFFICIENT_SOURCES',
      observation: null,
      divergences: Object.freeze([]),
      sourceCount: 0,
      averaged: false,
    });
  }

  if (uniqueTicks.length === 1) {
    const observation = normalizeObservation({
      tick: uniqueTicks[0]!,
      attribution: input.dedupeAttribution,
      outcome: 'PRIMARY_SELECTED',
    });
    return Object.freeze({
      schema: HELIOS_MD05_SCHEMA,
      symbol: input.symbol,
      venueId: input.venueId,
      outcome: 'PRIMARY_SELECTED',
      observation,
      divergences: Object.freeze([]),
      sourceCount: observation.contributingSources.length,
      averaged: false,
    });
  }

  const reference = pickPreferredTick(uniqueTicks, input.trustByProvider);
  let incompatible = false;

  for (const tick of uniqueTicks) {
    if (tick.replicaId === reference.replicaId) {
      continue;
    }
    const fields = listDivergenceFields(reference, tick);
    if (fields.length === 0) {
      continue;
    }
    incompatible = incompatible || !economicallyEquivalent(reference, tick);
    divergences.push(
      Object.freeze({
        schema: HELIOS_MD05_SCHEMA,
        symbol: input.symbol,
        venueId: input.venueId,
        detectedAt: input.decidedAt,
        fields: Object.freeze(fields),
        leftReplicaId: reference.replicaId,
        rightReplicaId: tick.replicaId,
        incompatible: fields.length > 0,
        message: `divergence on ${fields.join(', ')}`,
      }),
    );
  }

  if (incompatible) {
    return Object.freeze({
      schema: HELIOS_MD05_SCHEMA,
      symbol: input.symbol,
      venueId: input.venueId,
      outcome: 'INCOMPATIBLE',
      observation: null,
      divergences: Object.freeze(divergences),
      sourceCount: uniqueTicks.length,
      averaged: false,
    });
  }

  const allEquivalent = uniqueTicks.every((tick) => economicallyEquivalent(reference, tick));
  const outcome = allEquivalent ? 'UNANIMOUS' : 'DIVERGENT';

  if (!allEquivalent) {
    return Object.freeze({
      schema: HELIOS_MD05_SCHEMA,
      symbol: input.symbol,
      venueId: input.venueId,
      outcome: 'DIVERGENT',
      observation: null,
      divergences: Object.freeze(divergences),
      sourceCount: uniqueTicks.length,
      averaged: false,
    });
  }

  const attribution = mergeAttribution(input.dedupeAttribution, uniqueTicks);
  const observation = normalizeObservation({
    tick: reference,
    attribution,
    outcome,
  });

  return Object.freeze({
    schema: HELIOS_MD05_SCHEMA,
    symbol: input.symbol,
    venueId: input.venueId,
    outcome,
    observation,
    divergences: Object.freeze(divergences),
    sourceCount: attribution.length,
    averaged: false,
  });
}

function dedupeByMessageIdentity(ticks: readonly InboundMarketTick[]): InboundMarketTick[] {
  const map = new Map<string, InboundMarketTick>();
  for (const tick of ticks) {
    const key = `${tick.nativeSequence}|${tick.nativeMessageId}`;
    const prior = map.get(key);
    if (!prior || Date.parse(tick.arrivalTimestamp) < Date.parse(prior.arrivalTimestamp)) {
      map.set(key, tick);
    }
  }
  return [...map.values()];
}

function pickPreferredTick(
  ticks: readonly InboundMarketTick[],
  trustByProvider: Readonly<Record<string, ProviderTrustState>>,
): InboundMarketTick {
  return [...ticks].sort((left, right) => {
    const leftTrust = trustByProvider[left.providerId];
    const rightTrust = trustByProvider[right.providerId];
    if (leftTrust && rightTrust) {
      const trustDelta = compareProviderTrust(leftTrust, rightTrust);
      if (trustDelta !== 0) {
        return trustDelta;
      }
    }
    const roleDelta = ROLE_PRIORITY[right.role] - ROLE_PRIORITY[left.role];
    if (roleDelta !== 0) {
      return roleDelta;
    }
    return Date.parse(left.arrivalTimestamp) - Date.parse(right.arrivalTimestamp);
  })[0]!;
}

function mergeAttribution(
  base: readonly MarketSourceAttribution[],
  ticks: readonly InboundMarketTick[],
): readonly MarketSourceAttribution[] {
  const seen = new Set<string>();
  const merged: MarketSourceAttribution[] = [];
  for (const entry of base) {
    const key = `${entry.nativeSequence}|${entry.nativeMessageId}|${entry.replicaId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(entry);
  }
  for (const tick of ticks) {
    const key = `${tick.nativeSequence}|${tick.nativeMessageId}|${tick.replicaId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(
      Object.freeze({
        providerId: tick.providerId,
        replicaId: tick.replicaId,
        role: tick.role,
        nativeSequence: tick.nativeSequence,
        nativeMessageId: tick.nativeMessageId,
        arrivalTimestamp: tick.arrivalTimestamp,
      }),
    );
  }
  return Object.freeze(merged);
}

function normalizeObservation(input: {
  readonly tick: InboundMarketTick;
  readonly attribution: readonly MarketSourceAttribution[];
  readonly outcome: MarketObservationConsensus['outcome'];
}): NormalizedMarketObservation {
  return Object.freeze({
    schema: HELIOS_MD05_SCHEMA,
    observationKey: `${input.tick.symbol}|${input.tick.venueId}|${input.tick.nativeSequence}|${input.tick.nativeMessageId}`,
    symbol: input.tick.symbol,
    venueId: input.tick.venueId,
    currency: input.tick.currency,
    sourceTimestamp: input.tick.sourceTimestamp,
    arrivalTimestamp: input.tick.arrivalTimestamp,
    priceMinorUnits: input.tick.priceMinorUnits,
    sizeMinorUnits: input.tick.sizeMinorUnits,
    marketStatus: input.tick.marketStatus,
    contributingSources: input.attribution,
    selectedReplicaId: input.tick.replicaId,
    selectedRole: input.tick.role,
    consensusOutcome: input.outcome,
    readOnly: true,
  });
}
