import type { CertificationPolicy, CertificationSubject, FreshnessConformanceResult, ReliabilityProfile } from './types.ts';

export function evaluateFreshness(
  subject: CertificationSubject,
  policy: CertificationPolicy,
): FreshnessConformanceResult {
  const observation = subject.observations[0];
  if (!observation) {
    return Object.freeze({
      verdict: 'FAIL',
      stale: true,
      ageSeconds: Number.MAX_SAFE_INTEGER,
      details: Object.freeze(['no observation to score freshness']),
    });
  }
  const sourceTime = Number(observation.sourceTimestampUnix);
  const now = Number(subject.nowUnix);
  const ageSeconds = Number.isFinite(sourceTime) ? Math.max(0, now - sourceTime) : Number.MAX_SAFE_INTEGER;
  const stale = ageSeconds > policy.maximumObservationAgeSeconds;
  return Object.freeze({
    verdict: stale ? 'FAIL' : 'PASS',
    stale,
    ageSeconds,
    details: Object.freeze(
      stale
        ? [`observation is stale: ${ageSeconds}s > ${policy.maximumObservationAgeSeconds}s`]
        : [`observation age ${ageSeconds}s is within policy`],
    ),
  });
}

export function scoreReliability(
  subject: CertificationSubject,
  policy: CertificationPolicy,
): ReliabilityProfile {
  const observations = subject.observations;
  const count = Math.max(1, observations.length);
  let schemaValid = 0;
  let fresh = 0;
  let authOk = subject.connector.authenticationSucceeded ? count : 0;
  let timeouts = subject.connector.timedOut ? count : 0;
  let conflicts = 0;
  const latencies: number[] = [];

  for (const observation of observations) {
    const numericOk = /^-?\d+$/.test(observation.numericValue) && !observation.numericValue.includes('.');
    const schemaOk =
      observation.schemaId === subject.schemaId &&
      observation.schemaVersion === subject.schemaVersion &&
      observation.unit === subject.unit &&
      numericOk;
    if (schemaOk) {
      schemaValid += 1;
    }
    const age = Number(subject.nowUnix) - Number(observation.sourceTimestampUnix);
    if (Number.isFinite(age) && age <= policy.maximumObservationAgeSeconds) {
      fresh += 1;
    }
    if (observation.extras && observation.extras.conflict === true) {
      conflicts += 1;
    }
    latencies.push(typeof observation.extras?.latencyMs === 'number' ? observation.extras.latencyMs : 20);
  }

  const ids = observations.map((row) => row.sourceObservationId);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size < ids.length) {
    conflicts += ids.length - uniqueIds.size;
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor((latencies.length - 1) * 0.5)] ?? 0;
  const p95 = latencies[Math.floor((latencies.length - 1) * 0.95)] ?? p50;
  const availability = subject.connector.circuitBreakerOpen || timeouts === count ? 0 : 10_000;

  return Object.freeze({
    sandboxMetricsOnly: true,
    productionSlaClaimed: false,
    availabilityBps: availability,
    schemaValidityBps: Math.floor((schemaValid * 10_000) / count),
    freshnessBps: Math.floor((fresh * 10_000) / count),
    authSuccessBps: Math.floor((authOk * 10_000) / count),
    timeoutBps: Math.floor((timeouts * 10_000) / count),
    conflictBps: Math.min(10_000, Math.floor((conflicts * 10_000) / count)),
    rateLimitEvents: subject.connector.rateLimitEvents,
    latencyP50Ms: p50,
    latencyP95Ms: p95,
    observationCount: observations.length,
  });
}
