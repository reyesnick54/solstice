import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import {
  ALPHA22_SHADOW_LAB_ALERT_KINDS,
  type Alpha22ShadowLabAlertKind,
} from './taxonomy.ts';
import type { Alpha22ShadowLabAlert, ShadowLabTelemetrySnapshot } from './types.ts';

const DECISION_RATE_SPIKE_PER_MIN = 500;
const DRAWDOWN_BREACH_BPS = 1500;

export function listAlpha22AlertKinds(): readonly Alpha22ShadowLabAlertKind[] {
  return ALPHA22_SHADOW_LAB_ALERT_KINDS;
}

export function evaluateAlpha22ShadowLabAlerts(
  snapshot: ShadowLabTelemetrySnapshot,
  acknowledged: ReadonlySet<string> = new Set(),
): readonly Alpha22ShadowLabAlert[] {
  const fired: Alpha22ShadowLabAlert[] = [];
  const at = snapshot.observedAt;

  for (const campaign of snapshot.campaigns) {
    if (campaign.status === 'STOPPED') {
      pushAlert(fired, at, 'CAMPAIGN_STOPPED', `campaign ${campaign.campaignId} stopped`, acknowledged);
    }
    if (campaign.status === 'LEASE_LOST') {
      pushAlert(fired, at, 'LEASE_LOST', `campaign ${campaign.campaignId} lease lost`, acknowledged);
    }
  }

  if (!snapshot.leaseHeld) {
    pushAlert(fired, at, 'LEASE_LOST', 'shadow lab campaign lease not held', acknowledged);
  }

  if (snapshot.marketDataState === 'UNTRUSTED') {
    pushAlert(fired, at, 'MARKET_DATA_UNTRUSTED', 'market data untrusted for shadow decisions', acknowledged);
  }

  if (snapshot.pendingOutcomes > 50n && snapshot.outcomeBacklogAgeMs > 120_000) {
    pushAlert(fired, at, 'OUTCOME_BACKLOG', `outcome backlog ${snapshot.pendingOutcomes}`, acknowledged);
  }

  if (!snapshot.persistenceHealthy) {
    pushAlert(fired, at, 'PERSISTENCE_FAILURE', 'shadow lab persistence unhealthy', acknowledged);
  }

  if (!snapshot.evidenceHashOk || snapshot.evidenceStatus.mismatch) {
    pushAlert(fired, at, 'EVIDENCE_HASH_MISMATCH', 'evidence hash mismatch detected', acknowledged);
  }

  if (snapshot.decayStatus.strategiesInDecay.length > 0) {
    pushAlert(
      fired,
      at,
      'STRATEGY_DECAY',
      `decay flagged: ${snapshot.decayStatus.strategiesInDecay.join(',')}`,
      acknowledged,
    );
  }

  if (snapshot.drawdownBps >= DRAWDOWN_BREACH_BPS) {
    pushAlert(fired, at, 'DRAWDOWN_BREACH', `drawdown ${snapshot.drawdownBps} bps breach`, acknowledged);
  }

  if (snapshot.decisionsPerMinute >= DECISION_RATE_SPIKE_PER_MIN) {
    pushAlert(
      fired,
      at,
      'UNEXPECTED_DECISION_RATE_SPIKE',
      `decision rate ${snapshot.decisionsPerMinute}/min`,
      acknowledged,
    );
  }

  for (const provider of snapshot.providers) {
    if (!provider.healthy) {
      pushAlert(fired, at, 'PROVIDER_FAILURE', `provider ${provider.providerId} unhealthy`, acknowledged);
    }
  }

  return Object.freeze(fired);
}

function pushAlert(
  out: Alpha22ShadowLabAlert[],
  at: UtcInstant,
  kind: Alpha22ShadowLabAlertKind,
  summary: string,
  acknowledged: ReadonlySet<string>,
): void {
  const alertId = `al22_${createHash('sha256').update(`${kind}:${summary}:${at}`).digest('hex').slice(0, 16)}`;
  if (out.some((row) => row.kind === kind && row.summary === summary)) {
    return;
  }
  out.push(
    Object.freeze({
      alertId,
      kind,
      firedAt: at,
      summary,
      acknowledged: acknowledged.has(alertId),
    }),
  );
}
