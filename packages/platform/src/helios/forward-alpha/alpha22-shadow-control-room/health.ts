import type {
  CampaignHealth,
  EvidencePipelineHealth,
  ResearchDataHealth,
  ShadowHealthBand,
  ShadowLabHealth,
  ShadowLabTelemetrySnapshot,
  StrategyRuntimeHealth,
} from './types.ts';

function worstBand(bands: readonly ShadowHealthBand[]): ShadowHealthBand {
  if (bands.includes('UNHEALTHY')) return 'UNHEALTHY';
  if (bands.includes('DEGRADED')) return 'DEGRADED';
  if (bands.includes('UNKNOWN')) return 'UNKNOWN';
  return 'HEALTHY';
}

function campaignRowBand(row: ShadowLabTelemetrySnapshot['campaigns'][number]): ShadowHealthBand {
  if (row.status === 'LEASE_LOST' || row.status === 'STOPPED' || row.status === 'TERMINATED') {
    return 'UNHEALTHY';
  }
  if (row.status === 'PAUSED') return 'DEGRADED';
  return 'HEALTHY';
}

export function buildShadowLabHealth(snapshot: ShadowLabTelemetrySnapshot): ShadowLabHealth {
  const mode =
    snapshot.activeCampaignCount === 0 && snapshot.campaigns.every((c) => c.status === 'TERMINATED')
      ? ('TERMINATED' as const)
      : snapshot.campaigns.some((c) => c.status === 'PAUSED')
        ? ('PAUSED' as const)
        : ('CONTINUOUS_RESEARCH' as const);
  const bands: ShadowHealthBand[] = [];
  if (!snapshot.leaseHeld) bands.push('UNHEALTHY');
  if (snapshot.errorCount > 0n) bands.push('DEGRADED');
  if (snapshot.persistenceHealthy === false) bands.push('UNHEALTHY');
  const band = worstBand(bands.length ? bands : (['HEALTHY'] as const));
  const summary = !snapshot.leaseHeld
    ? 'campaign lease lost'
    : snapshot.persistenceHealthy
      ? 'shadow lab continuous research posture'
      : 'persistence unhealthy';
  return Object.freeze({
    schema: 'sunrey.helios.alpha22.shadow-lab-health.v1',
    band,
    runtimeMode: mode,
    leaseHeld: snapshot.leaseHeld,
    errorCount: snapshot.errorCount,
    summary,
  });
}

export function buildCampaignHealth(snapshot: ShadowLabTelemetrySnapshot): CampaignHealth {
  const rows = snapshot.campaigns.map((row) =>
    Object.freeze({
      campaignId: row.campaignId,
      status: row.status,
      band: campaignRowBand(row),
    }),
  );
  const band = worstBand(rows.map((r) => r.band));
  return Object.freeze({
    schema: 'sunrey.helios.alpha22.campaign-health.v1',
    band,
    activeCampaigns: snapshot.activeCampaignCount,
    rows: Object.freeze(rows),
  });
}

export function buildStrategyRuntimeHealth(snapshot: ShadowLabTelemetrySnapshot): StrategyRuntimeHealth {
  const paused = snapshot.strategies.filter((s) => s.paused).length;
  const decay = snapshot.strategies.filter((s) => s.decayFlagged).length;
  const bands: ShadowHealthBand[] = [];
  if (decay > 0) bands.push('DEGRADED');
  if (paused === snapshot.strategies.length && snapshot.strategies.length > 0) bands.push('DEGRADED');
  const band = worstBand(bands.length ? bands : (['HEALTHY'] as const));
  return Object.freeze({
    schema: 'sunrey.helios.alpha22.strategy-runtime-health.v1',
    band,
    activeStrategies: snapshot.activeStrategyCount,
    pausedStrategies: paused,
    decayFlagged: decay,
  });
}

export function buildResearchDataHealth(snapshot: ShadowLabTelemetrySnapshot): ResearchDataHealth {
  const providerFailureCount = snapshot.providers.filter((p) => !p.healthy).length;
  let band: ShadowHealthBand = 'HEALTHY';
  if (snapshot.marketDataState === 'UNTRUSTED') band = 'UNHEALTHY';
  else if (snapshot.marketDataState === 'DEGRADED' || providerFailureCount > 0) band = 'DEGRADED';
  else if (snapshot.marketDataState === 'UNKNOWN') band = 'UNKNOWN';
  return Object.freeze({
    schema: 'sunrey.helios.alpha22.research-data-health.v1',
    band,
    marketDataState: snapshot.marketDataState,
    marketDataAgeMs: snapshot.marketDataAgeMs,
    providerFailureCount,
  });
}

export function buildEvidencePipelineHealth(snapshot: ShadowLabTelemetrySnapshot): EvidencePipelineHealth {
  let band: ShadowHealthBand = 'HEALTHY';
  if (!snapshot.evidenceHashOk || snapshot.evidenceStatus.mismatch) band = 'UNHEALTHY';
  else if (snapshot.pendingOutcomes > 100n) band = 'DEGRADED';
  else if (!snapshot.persistenceHealthy) band = 'UNHEALTHY';
  return Object.freeze({
    schema: 'sunrey.helios.alpha22.evidence-pipeline-health.v1',
    band,
    persisted: snapshot.evidenceStatus.persisted,
    hashOk: snapshot.evidenceHashOk,
    pendingOutcomes: snapshot.pendingOutcomes,
    outcomeBacklogAgeMs: snapshot.outcomeBacklogAgeMs,
  });
}
