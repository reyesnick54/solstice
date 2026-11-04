import { asUtcInstant } from '@solstice/domain';

import { asResearchMonitorId } from '../research-monitor/ids.ts';
import { RESEARCH_MONITOR_SCHEMA_VERSION } from '../research-monitor/taxonomy.ts';
import type {
  PointInTimeFeatureRequirement,
  ResearchMonitorDefinition,
} from '../research-monitor/types.ts';

const EARN11_MONITOR_START = asUtcInstant('2026-11-01T00:00:00.000Z');
const EARN11_MONITOR_END = asUtcInstant('2027-11-01T00:00:00.000Z');

function earn11MonitorBase(
  name: string,
  researchTopic: string,
  watch: readonly string[],
  description: string,
): ResearchMonitorDefinition {
  const definition = {
    monitorId: asResearchMonitorId(`monitor_earn11_${name}`),
    name,
    version: Object.freeze({
      major: 1,
      minor: 0,
      patch: 0,
      schemaVersion: RESEARCH_MONITOR_SCHEMA_VERSION,
    }),
    watch,
    condition: Object.freeze({
      expression: Object.freeze({
        kind: 'binary',
        op: 'gt',
        left: Object.freeze({ kind: 'feature', featureId: `EARN11_${name}_triggerScore` }),
        right: Object.freeze({ kind: 'number', value: '1.0' }),
      }),
      description,
    }),
    trigger: Object.freeze({
      action: 'REQUEST_RESEARCH',
      researchTopic,
    }),
    startAt: EARN11_MONITOR_START,
    expiresAt: EARN11_MONITOR_END,
    cooldownMs: 7_200_000,
    maxTriggers: 12,
    researchBudgetMinor: '250',
    priority: 'HIGH',
    allowedAgentClasses: Object.freeze(['EARNINGS_RESEARCH', 'EQUITY_SPECIALIST']),
    requiredEvidence: Object.freeze(['EARNINGS', 'AAF_V2_FEATURE_MANIFEST']),
    pointInTimeFeatureRequirements: Object.freeze([
      {
        featureId: `EARN11_${name}_triggerScore`,
        maxAgeMs: 3_600_000,
        requiredKind: 'earnings_event_state',
      } satisfies PointInTimeFeatureRequirement,
    ] as readonly PointInTimeFeatureRequirement[]),
    staleDataPolicy: 'FAIL_CLOSED' as const,
  } satisfies ResearchMonitorDefinition;
  return Object.freeze(definition);
}

/** Major consensus revision acceleration — triggers research, not execution. */
export function consensusRevisionAccelerationMonitor(): ResearchMonitorDefinition {
  return earn11MonitorBase(
    'consensus_revision_acceleration',
    'earn11_consensus_revision_acceleration',
    Object.freeze(['SPY', 'XLK']),
    'Major consensus revision acceleration into earnings season',
  );
}

/** Large implied-vs-historical earnings move dislocation. */
export function impliedVsHistoricalMoveMonitor(): ResearchMonitorDefinition {
  return earn11MonitorBase(
    'implied_vs_historical_move',
    'earn11_implied_historical_move_dislocation',
    Object.freeze(['NVDA', 'AAPL']),
    'Options implied move far from historical realized earnings move',
  );
}

/** Strong transcript vs consensus disagreement. */
export function transcriptConsensusDisagreementMonitor(): ResearchMonitorDefinition {
  return earn11MonitorBase(
    'transcript_consensus_disagreement',
    'earn11_transcript_consensus_gap',
    Object.freeze(['MSFT', 'GOOGL']),
    'Transcript tone and Q&A quality diverge from pre-call consensus',
  );
}

/** Earnings quality deterioration with headline beat. */
export function earningsQualityHeadlineBeatMonitor(): ResearchMonitorDefinition {
  return earn11MonitorBase(
    'quality_deterioration_headline_beat',
    'earn11_quality_deterioration_headline_beat',
    Object.freeze(['IBM', 'ORCL']),
    'Earnings quality deterioration despite headline beat',
  );
}

/** Peer information shock read-through. */
export function peerInformationShockMonitor(): ResearchMonitorDefinition {
  return earn11MonitorBase(
    'peer_information_shock',
    'earn11_peer_read_through_shock',
    Object.freeze(['AMD', 'INTC', 'NVDA']),
    'Peer cohort earnings shock with read-through to non-reporting names',
  );
}

export const EARN11_RESEARCH_MONITORS = Object.freeze([
  consensusRevisionAccelerationMonitor(),
  impliedVsHistoricalMoveMonitor(),
  transcriptConsensusDisagreementMonitor(),
  earningsQualityHeadlineBeatMonitor(),
  peerInformationShockMonitor(),
] as const);

export function earn11MonitorsTriggerResearchOnly(): boolean {
  return EARN11_RESEARCH_MONITORS.every((monitor) => monitor.trigger.action === 'REQUEST_RESEARCH');
}
