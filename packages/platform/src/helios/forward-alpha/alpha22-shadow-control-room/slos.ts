import {
  ALPHA22_ENGINEERING_SLO_IDS,
  type Alpha22EngineeringSloId,
} from './taxonomy.ts';
import type { Alpha22EngineeringSloTarget, Alpha22SloEvaluation, ShadowLabTelemetrySnapshot } from './types.ts';

const CAMPAIGN_RUNTIME_MIN = 0.995;
const DECISION_FRESHNESS_MAX_MS = 120_000;
const OUTCOME_ATTACHMENT_MAX_MS = 300_000;
const EVIDENCE_PERSISTENCE_MAX_MS = 60_000;
const MARKET_DATA_FRESHNESS_MAX_MS = 15_000;
const RECOVERY_TIME_MAX_MS = 600_000;

export function listAlpha22EngineeringSloTargets(): readonly Alpha22EngineeringSloTarget[] {
  return Object.freeze(
    ALPHA22_ENGINEERING_SLO_IDS.map((sloId) => Object.freeze(targetFor(sloId))),
  );
}

function targetFor(sloId: Alpha22EngineeringSloId): Alpha22EngineeringSloTarget {
  switch (sloId) {
    case 'CAMPAIGN_RUNTIME_AVAILABILITY':
      return {
        sloId,
        description: 'Shadow campaign tick loop available for continuous research windows',
        target: `availability_ratio >= ${CAMPAIGN_RUNTIME_MIN}`,
      };
    case 'DECISION_PROCESSING_FRESHNESS':
      return {
        sloId,
        description: 'Decision pipeline lag from last market snapshot',
        target: `freshness_age_ms <= ${DECISION_FRESHNESS_MAX_MS}`,
      };
    case 'OUTCOME_ATTACHMENT_LATENCY':
      return {
        sloId,
        description: 'Pending outcomes attached within engineering bound',
        target: `backlog_age_ms <= ${OUTCOME_ATTACHMENT_MAX_MS}`,
      };
    case 'EVIDENCE_PERSISTENCE':
      return {
        sloId,
        description: 'Evidence seals persisted within bounded latency',
        target: `persist_latency_ms <= ${EVIDENCE_PERSISTENCE_MAX_MS}`,
      };
    case 'MARKET_DATA_FRESHNESS':
      return {
        sloId,
        description: 'Trusted market data age for shadow decisions',
        target: `market_data_age_ms <= ${MARKET_DATA_FRESHNESS_MAX_MS} when TRUSTED`,
      };
    case 'RECOVERY_TIME':
      return {
        sloId,
        description: 'Time to restore shadow lab after simulated fault',
        target: `recovery_duration_ms <= ${RECOVERY_TIME_MAX_MS}`,
      };
    default:
      throw new Error(`unknown SLO ${sloId}`);
  }
}

export function evaluateAlpha22EngineeringSlos(snapshot: ShadowLabTelemetrySnapshot): readonly Alpha22SloEvaluation[] {
  return Object.freeze([
    evaluateCampaignRuntime(snapshot),
    evaluateDecisionFreshness(snapshot),
    evaluateOutcomeAttachment(snapshot),
    evaluateEvidencePersistence(snapshot),
    evaluateMarketDataFreshness(snapshot),
    evaluateRecoveryTime(snapshot),
  ]);
}

function evaluateCampaignRuntime(snapshot: ShadowLabTelemetrySnapshot): Alpha22SloEvaluation {
  const met = snapshot.campaignRuntimeAvailabilityRatio >= CAMPAIGN_RUNTIME_MIN && snapshot.leaseHeld;
  return sloResult(
    'CAMPAIGN_RUNTIME_AVAILABILITY',
    met,
    String(snapshot.campaignRuntimeAvailabilityRatio),
    snapshot.leaseHeld ? 'lease held' : 'lease lost',
  );
}

function evaluateDecisionFreshness(snapshot: ShadowLabTelemetrySnapshot): Alpha22SloEvaluation {
  const met = snapshot.decisionFreshnessAgeMs <= DECISION_FRESHNESS_MAX_MS;
  return sloResult(
    'DECISION_PROCESSING_FRESHNESS',
    met,
    String(snapshot.decisionFreshnessAgeMs),
    'decision freshness age ms',
  );
}

function evaluateOutcomeAttachment(snapshot: ShadowLabTelemetrySnapshot): Alpha22SloEvaluation {
  const met = snapshot.pendingOutcomes === 0n || snapshot.outcomeBacklogAgeMs <= OUTCOME_ATTACHMENT_MAX_MS;
  return sloResult(
    'OUTCOME_ATTACHMENT_LATENCY',
    met,
    String(snapshot.outcomeBacklogAgeMs),
    `pending_outcomes=${snapshot.pendingOutcomes}`,
  );
}

function evaluateEvidencePersistence(snapshot: ShadowLabTelemetrySnapshot): Alpha22SloEvaluation {
  const met = snapshot.persistenceHealthy && snapshot.evidencePersistLatencyMs <= EVIDENCE_PERSISTENCE_MAX_MS;
  return sloResult(
    'EVIDENCE_PERSISTENCE',
    met,
    String(snapshot.evidencePersistLatencyMs),
    snapshot.persistenceHealthy ? 'persistence healthy' : 'persistence failure',
  );
}

function evaluateMarketDataFreshness(snapshot: ShadowLabTelemetrySnapshot): Alpha22SloEvaluation {
  const met =
    snapshot.marketDataState !== 'TRUSTED' ||
    snapshot.marketDataAgeMs <= MARKET_DATA_FRESHNESS_MAX_MS;
  return sloResult(
    'MARKET_DATA_FRESHNESS',
    met,
    String(snapshot.marketDataAgeMs),
    `state=${snapshot.marketDataState}`,
  );
}

function evaluateRecoveryTime(snapshot: ShadowLabTelemetrySnapshot): Alpha22SloEvaluation {
  const duration = snapshot.recoveryDurationMs;
  const met = duration === null || duration <= RECOVERY_TIME_MAX_MS;
  return sloResult(
    'RECOVERY_TIME',
    met,
    duration === null ? 'n/a' : String(duration),
    'post-incident recovery duration',
  );
}

function sloResult(
  sloId: Alpha22EngineeringSloId,
  met: boolean,
  observed: string,
  detail: string,
): Alpha22SloEvaluation {
  return Object.freeze({ sloId, met, observed, detail });
}
