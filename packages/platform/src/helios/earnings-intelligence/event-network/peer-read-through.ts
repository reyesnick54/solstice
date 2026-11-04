/**
 * Peer read-through aggregates — time-ordered; later reporters cannot inform earlier decisions.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { EarningsPeerRelationshipEdge, EarningsEventRecord, PeerReadThroughSnapshot } from './types.ts';
import type {
  EarningsGuidanceDirection,
  EarningsSignalDirection,
  EarningsSurpriseState,
} from './taxonomy.ts';

export type PeerReadThroughInput = {
  readonly focalEvent: EarningsEventRecord;
  readonly allEvents: readonly EarningsEventRecord[];
  readonly relationships: readonly EarningsPeerRelationshipEdge[];
  readonly asOfDecisionInstant: UtcInstant;
  readonly knowableCutoff: UtcInstant;
};

function linkedPeerSecurityIds(
  focalSecurityNodeId: string,
  relationships: readonly EarningsPeerRelationshipEdge[],
): ReadonlySet<string> {
  const peers = new Set<string>();
  for (const edge of relationships) {
    if (edge.fromSecurityNodeId === focalSecurityNodeId) {
      peers.add(edge.toSecurityNodeId);
    } else if (edge.toSecurityNodeId === focalSecurityNodeId) {
      peers.add(edge.fromSecurityNodeId);
    }
  }
  return peers;
}

function aggregateSurprise(states: readonly EarningsSurpriseState[]): EarningsSurpriseState {
  if (states.length === 0) return 'UNKNOWN';
  const unique = new Set(states.filter((s) => s !== 'UNKNOWN'));
  if (unique.size === 0) return 'UNKNOWN';
  if (unique.size === 1) return [...unique][0]!;
  if (unique.has('BEAT') && unique.has('MISS')) return 'MIXED';
  return 'MIXED';
}

function aggregateGuidance(directions: readonly EarningsGuidanceDirection[]): EarningsGuidanceDirection {
  if (directions.length === 0) return 'UNKNOWN';
  const filtered = directions.filter((d) => d !== 'UNKNOWN');
  if (filtered.length === 0) return 'UNKNOWN';
  const unique = new Set(filtered);
  if (unique.size === 1) return [...unique][0]!;
  return 'MIXED';
}

function aggregateSignal(signals: readonly EarningsSignalDirection[]): EarningsSignalDirection {
  if (signals.length === 0) return 'UNKNOWN';
  const filtered = signals.filter((s) => s !== 'UNKNOWN');
  if (filtered.length === 0) return 'UNKNOWN';
  const unique = new Set(filtered);
  if (unique.size === 1) return [...unique][0]!;
  return 'MIXED';
}

function meanNullable(values: readonly (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function breadthBeat(events: readonly EarningsEventRecord[]): number | null {
  const scored = events.filter((e) => e.surpriseState === 'BEAT' || e.surpriseState === 'MISS' || e.surpriseState === 'INLINE');
  if (scored.length === 0) return null;
  const beats = scored.filter((e) => e.surpriseState === 'BEAT').length;
  return beats / scored.length;
}

function revisionBreadth(events: readonly EarningsEventRecord[]): number | null {
  const withSpeed = events.filter((e) => e.analystRevisionSpeedHours !== null);
  if (withSpeed.length === 0) return null;
  const fast = withSpeed.filter((e) => (e.analystRevisionSpeedHours ?? 999) <= 24).length;
  return fast / withSpeed.length;
}

/**
 * Select peer events that are strictly knowable before the focal decision and announced before the focal event.
 */
export function selectInformingPeerEvents(input: PeerReadThroughInput): readonly EarningsEventRecord[] {
  const peerIds = linkedPeerSecurityIds(input.focalEvent.securityNodeId, input.relationships);
  const sameIndustry =
    input.focalEvent.industryCode !== null
      ? input.allEvents.filter(
          (e) =>
            e.eventId !== input.focalEvent.eventId &&
            e.industryCode === input.focalEvent.industryCode &&
            e.fiscalPeriod === input.focalEvent.fiscalPeriod,
        )
      : [];

  const candidateIds = new Set<string>([...peerIds]);
  for (const e of sameIndustry) {
    candidateIds.add(e.securityNodeId);
  }

  return input.allEvents.filter((peer) => {
    if (peer.eventId === input.focalEvent.eventId) return false;
    if (!candidateIds.has(peer.securityNodeId)) return false;
    if (peer.knowableAt > input.knowableCutoff) return false;
    if (peer.announcementInstant >= input.focalEvent.announcementInstant) return false;
    if (peer.knowableAt > input.asOfDecisionInstant) return false;
    return true;
  });
}

export function computePeerReadThrough(input: PeerReadThroughInput): PeerReadThroughSnapshot {
  const informing = selectInformingPeerEvents(input);
  const industryPeers = input.allEvents.filter(
    (e) =>
      e.eventId !== input.focalEvent.eventId &&
      e.industryCode !== null &&
      e.industryCode === input.focalEvent.industryCode &&
      e.fiscalPeriod === input.focalEvent.fiscalPeriod &&
      e.knowableAt <= input.knowableCutoff &&
      e.announcementInstant < input.focalEvent.announcementInstant,
  );

  return Object.freeze({
    asOfDecisionInstant: input.asOfDecisionInstant,
    knowableCutoff: input.knowableCutoff,
    informingPeerEventIds: Object.freeze(informing.map((e) => e.eventId)),
    peerSurpriseState: aggregateSurprise(informing.map((e) => e.surpriseState)),
    peerAnnouncementReturnBps: meanNullable(informing.map((e) => e.announcementReturnBps)),
    peerGuidanceDirection: aggregateGuidance(informing.map((e) => e.guidanceDirection)),
    peerMarginSignal: aggregateSignal(informing.map((e) => e.marginSignal)),
    peerDemandSignal: aggregateSignal(informing.map((e) => e.demandSignal)),
    industryEarningsBreadth: breadthBeat(industryPeers),
    industryRevisionBreadth: revisionBreadth(industryPeers),
    grantsExecutionAuthority: false,
  });
}
