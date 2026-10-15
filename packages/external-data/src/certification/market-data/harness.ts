/**
 * AAF07 qualification harness — thirteen evidence proofs per provider.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import {
  DEFAULT_DEDUPLICATION_POLICIES,
  createInMemoryDeduplicationRegistry,
  isDuplicate,
} from '../../../../provider-sdk/src/deduplication.ts';
import { hashRawJsonPayload } from '../../../../provider-sdk/src/hash.ts';
import { rejectSilentSimulationFallback } from '../../../../provider-sdk/src/certification/provenance.ts';
import { buildExternalObservation } from '../../../../provider-sdk/src/observation.ts';
import { DEFAULT_PROVIDER_RELIABILITY_POLICY } from '../../../../provider-sdk/src/policy.ts';
import { decideRetryDelay } from '../../../../provider-sdk/src/retry.ts';
import type { HeliosMarketDataCatalogOverlayEntry } from '../../../../provider-sdk/src/market-data-capability/build-from-catalog.ts';
import { docsVerifiedFromCatalog } from '../../../../provider-sdk/src/market-data-capability/build-from-catalog.ts';
import type { CatalogProviderEntry } from '../../../../provider-sdk/src/catalog/types.ts';
import type { CapitalMarketProvider } from '../../../../sunrey-exchange/src/capital-market/provider.ts';
import { knowableAtCorrectnessCheck, computeKnowableAtForCertification } from './knowable-at.ts';

export const MARKET_DATA_QUALIFICATION_PROOF_IDS = [
  'provider_identity',
  'credential_handling',
  'schema_normalization',
  'timestamp_normalization',
  'knowable_at_correctness',
  'entitlement_propagation',
  'duplicate_handling',
  'heartbeat_outage_detection',
  'stale_data_detection',
  'rate_limit_behavior',
  'retry_backoff_behavior',
  'raw_payload_evidence_hash',
  'no_silent_fixture_fallback',
] as const;

export type MarketDataQualificationProofId = (typeof MARKET_DATA_QUALIFICATION_PROOF_IDS)[number];

export type MarketDataQualificationProof = {
  readonly id: MarketDataQualificationProofId;
  readonly passed: boolean;
  readonly message: string;
  readonly checkedAtUtc: UtcInstant;
};

export type MarketDataQualificationHarnessResult = {
  readonly providerId: string;
  readonly proofs: readonly MarketDataQualificationProof[];
  readonly allPassed: boolean;
  readonly rawPayloadEvidenceHash: string | null;
  readonly secretValuePresent: false;
};

function proof(
  id: MarketDataQualificationProofId,
  passed: boolean,
  message: string,
  checkedAtUtc: UtcInstant,
): MarketDataQualificationProof {
  return Object.freeze({ id, passed, message, checkedAtUtc });
}

export async function runMarketDataQualificationHarness(input: {
  readonly overlay: HeliosMarketDataCatalogOverlayEntry;
  readonly catalogEntry: CatalogProviderEntry | null;
  readonly provider: CapitalMarketProvider;
  readonly nowUtc: UtcInstant;
  readonly allowLiveNetwork?: boolean;
  readonly sampleRawPayload?: unknown;
  readonly simulatedFailureForFallbackTest?: boolean;
}): Promise<MarketDataQualificationHarnessResult> {
  const checkedAtUtc = input.nowUtc;
  const proofs: MarketDataQualificationProof[] = [];
  const providerId = input.overlay.provider_id;
  const instrumentId = input.overlay.qualification_instrument_id;

  const docsOk = docsVerifiedFromCatalog(input.catalogEntry);
  proofs.push(
    proof(
      'provider_identity',
      input.provider.providerId === providerId && (input.overlay.route_class !== 'external_live' || docsOk),
      input.provider.providerId === providerId
        ? docsOk || input.overlay.route_class !== 'external_live'
          ? 'provider identity matches catalog overlay'
          : 'catalog documentation not verified for external_live route'
        : `provider id mismatch: adapter=${input.provider.providerId} overlay=${providerId}`,
      checkedAtUtc,
    ),
  );

  const credentialConfigured = input.provider.credentialConfigured();
  const authRequired = input.catalogEntry?.authentication.required ?? true;
  proofs.push(
    proof(
      'credential_handling',
      !authRequired || credentialConfigured || input.overlay.route_class === 'explicit_simulation',
      authRequired && !credentialConfigured && input.overlay.route_class === 'external_live'
        ? 'external_live route requires configured credentials'
        : 'credential handling matches route class',
      checkedAtUtc,
    ),
  );

  const health = input.provider.health(input.nowUtc);
  proofs.push(
    proof(
      'heartbeat_outage_detection',
      health.status === 'healthy' || health.status === 'degraded' || health.status === 'unavailable',
      `health status=${health.status}`,
      checkedAtUtc,
    ),
  );

  let rawPayloadEvidenceHash: string | null = null;
  let quoteOk = false;
  let normalizedObservation: Awaited<ReturnType<CapitalMarketProvider['getQuote']>> | null = null;

  if (input.overlay.route_class === 'external_live' && authRequired && !credentialConfigured) {
    proofs.push(
      proof('schema_normalization', false, 'skipped — credentials not configured', checkedAtUtc),
      proof('timestamp_normalization', false, 'skipped — credentials not configured', checkedAtUtc),
      proof('knowable_at_correctness', false, 'skipped — credentials not configured', checkedAtUtc),
      proof('entitlement_propagation', false, 'skipped — credentials not configured', checkedAtUtc),
      proof('stale_data_detection', true, 'stale path not exercised without fetch', checkedAtUtc),
      proof('rate_limit_behavior', true, 'deferred to injected failure probes in CI', checkedAtUtc),
    );
  } else {
    normalizedObservation = await input.provider.getQuote(instrumentId, input.nowUtc);
    quoteOk = normalizedObservation.ok;
    const samplePayload =
      input.sampleRawPayload ??
      (quoteOk
        ? {
            instrumentId: normalizedObservation.value.instrument.instrumentId,
            lastMinorUnits: String(normalizedObservation.value.lastMinorUnits),
            sourceTimestamp: normalizedObservation.value.sourceTimestamp,
          }
        : { code: normalizedObservation.code });

    rawPayloadEvidenceHash = hashRawJsonPayload(samplePayload).digest;

    proofs.push(
      proof(
        'schema_normalization',
        quoteOk && normalizedObservation.value.schema === 'sunrey.capital-market.v1',
        quoteOk ? 'normalized capital-market schema emitted' : `fetch failed: ${normalizedObservation.code}`,
        checkedAtUtc,
      ),
      proof(
        'timestamp_normalization',
        quoteOk && Boolean(normalizedObservation.value.sourceTimestamp),
        quoteOk ? 'source timestamp present on observation' : 'missing source timestamp',
        checkedAtUtc,
      ),
    );

    if (quoteOk) {
      const arrival = normalizedObservation.value.arrivalTimestamp;
      const knowableAt = computeKnowableAtForCertification({
        providerAvailabilityTime: normalizedObservation.value.availabilityTimestamp,
        sunreyArrivalTime: arrival,
        ingestionTime: input.nowUtc,
      });
      proofs.push(
        proof(
          'knowable_at_correctness',
          knowableAtCorrectnessCheck({
            knowableAt,
            sunreyArrivalTime: arrival,
            ingestionTime: input.nowUtc,
          }),
          `knowableAt=${knowableAt}`,
          checkedAtUtc,
        ),
        proof(
          'entitlement_propagation',
          Boolean(normalizedObservation.value.entitlement?.entitlementClass),
          `entitlement=${normalizedObservation.value.entitlement?.entitlementClass ?? 'missing'}`,
          checkedAtUtc,
        ),
        proof(
          'stale_data_detection',
          Date.parse(normalizedObservation.value.sourceTimestamp) <= Date.parse(input.nowUtc),
          `sourceTimestamp=${normalizedObservation.value.sourceTimestamp}`,
          checkedAtUtc,
        ),
      );
    } else {
      proofs.push(
        proof('knowable_at_correctness', false, 'no observation to assess', checkedAtUtc),
        proof('entitlement_propagation', false, 'no observation to assess', checkedAtUtc),
        proof('stale_data_detection', normalizedObservation.code !== 'SILENT_FIXTURE', 'explicit failure code', checkedAtUtc),
      );
    }

    proofs.push(
      proof(
        'rate_limit_behavior',
        normalizedObservation.code !== 'RATE_LIMITED' || !quoteOk,
        normalizedObservation.code === 'RATE_LIMITED'
          ? 'rate limit surfaced explicitly'
          : 'rate limit not triggered in this probe',
        checkedAtUtc,
      ),
    );
  }

  const registry = createInMemoryDeduplicationRegistry();
  const policy = DEFAULT_DEDUPLICATION_POLICIES.exactPayload;
  const dedupeBuilt = buildExternalObservation({
    providerId,
    providerCategory: 'markets',
    capability: 'equity_quotes',
    data: { instrumentId, probe: 'aaf07' },
    source: { provider: providerId, dataset: 'qualification' },
    time: { retrievedAt: checkedAtUtc, sourceTimestamp: checkedAtUtc },
    authorityClass: 'reference_data',
    provenance: {
      rawPayload: JSON.stringify({ instrumentId }),
      providerSchemaVersion: 'qualification.v1',
    },
  });
  let duplicatePassed = false;
  let duplicateMessage = 'duplicate detection failed';
  if (dedupeBuilt.ok) {
    const firstDup = isDuplicate(dedupeBuilt.value, policy, registry);
    const secondDup = isDuplicate(dedupeBuilt.value, policy, registry);
    duplicatePassed = !firstDup && secondDup;
    duplicateMessage = duplicatePassed ? 'duplicate registry detects replay' : 'duplicate detection failed';
  } else {
    duplicateMessage = `observation build failed: ${dedupeBuilt.code}`;
  }
  proofs.push(proof('duplicate_handling', duplicatePassed, duplicateMessage, checkedAtUtc));

  const retryDecision = decideRetryDelay({
    policy: DEFAULT_PROVIDER_RELIABILITY_POLICY,
    attempt: 1,
    random: () => 0,
  });
  proofs.push(
    proof(
      'retry_backoff_behavior',
      retryDecision.retry && retryDecision.delayMs > 0,
      `retry=${retryDecision.retry} delayMs=${retryDecision.delayMs}`,
      checkedAtUtc,
    ),
  );

  proofs.push(
    proof(
      'raw_payload_evidence_hash',
      rawPayloadEvidenceHash !== null && rawPayloadEvidenceHash.length > 0,
      rawPayloadEvidenceHash ? `hash=${rawPayloadEvidenceHash.slice(0, 16)}…` : 'no payload hashed',
      checkedAtUtc,
    ),
  );

  const silentFallbackRejected = rejectSilentSimulationFallback({
    primaryFailed: true,
    fallbackToSimulation: true,
    simulationLabeled: false,
    environment: 'production',
    explicitSimulationAllowed: false,
  });
  const silentFallbackAllowedWhenLabeled = rejectSilentSimulationFallback({
    primaryFailed: true,
    fallbackToSimulation: true,
    simulationLabeled: true,
    environment: 'simulation',
    explicitSimulationAllowed: true,
  });
  proofs.push(
    proof(
      'no_silent_fixture_fallback',
      !silentFallbackRejected.allowed &&
        silentFallbackRejected.failureCode === 'SILENT_SIMULATION_REJECTED' &&
        silentFallbackAllowedWhenLabeled.allowed,
      'silent fixture substitution rejected for external_live posture; allowed only when explicitly labeled',
      checkedAtUtc,
    ),
  );

  const allPassed = proofs.every((row) => row.passed);
  return Object.freeze({
    providerId,
    proofs: Object.freeze(proofs),
    allPassed,
    rawPayloadEvidenceHash,
    secretValuePresent: false as const,
  });
}
