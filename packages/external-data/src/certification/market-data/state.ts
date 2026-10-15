/**
 * Derive AAF07 certification state from harness evidence.
 */

import type { MarketDataCertificationState } from '../../../../provider-sdk/src/market-data-capability/certification-states.ts';
import type { MarketDataQualificationHarnessResult } from './harness.ts';
import type { HeliosMarketDataCatalogOverlayEntry } from '../../../../provider-sdk/src/market-data-capability/build-from-catalog.ts';
import { docsVerifiedFromCatalog } from '../../../../provider-sdk/src/market-data-capability/build-from-catalog.ts';
import type { CatalogProviderEntry } from '../../../../provider-sdk/src/catalog/types.ts';

function proofPassed(result: MarketDataQualificationHarnessResult, id: string): boolean {
  return result.proofs.find((row) => row.id === id)?.passed ?? false;
}

export function deriveMarketDataCertificationState(input: {
  readonly overlay: HeliosMarketDataCatalogOverlayEntry;
  readonly catalogEntry: CatalogProviderEntry | null;
  readonly credentialConfigured: boolean;
  readonly harness: MarketDataQualificationHarnessResult;
  readonly explicitlySuspended?: boolean;
  readonly explicitlyDegraded?: boolean;
}): MarketDataCertificationState {
  if (input.explicitlySuspended) {
    return 'SUSPENDED';
  }
  if (input.explicitlyDegraded || !proofPassed(input.harness, 'no_silent_fixture_fallback')) {
    return 'DEGRADED';
  }
  if (!docsVerifiedFromCatalog(input.catalogEntry)) {
    return 'REGISTERED';
  }
  if (!input.credentialConfigured && input.catalogEntry?.authentication.required) {
    return 'DOCS_VERIFIED';
  }
  if (!proofPassed(input.harness, 'credential_handling')) {
    return 'CREDENTIAL_READY';
  }
  if (!proofPassed(input.harness, 'schema_normalization')) {
    return input.overlay.route_class === 'sandbox' ? 'SANDBOX_VERIFIED' : 'CREDENTIAL_READY';
  }
  if (!proofPassed(input.harness, 'timestamp_normalization') || !proofPassed(input.harness, 'knowable_at_correctness')) {
    return 'SANDBOX_VERIFIED';
  }
  if (!proofPassed(input.harness, 'entitlement_propagation')) {
    return 'TIMESTAMP_VERIFIED';
  }
  if (
    !proofPassed(input.harness, 'duplicate_handling') ||
    !proofPassed(input.harness, 'stale_data_detection') ||
    !proofPassed(input.harness, 'heartbeat_outage_detection')
  ) {
    return 'ENTITLEMENT_VERIFIED';
  }
  if (
    !proofPassed(input.harness, 'rate_limit_behavior') ||
    !proofPassed(input.harness, 'retry_backoff_behavior') ||
    !proofPassed(input.harness, 'raw_payload_evidence_hash')
  ) {
    return 'QUALITY_VERIFIED';
  }
  if (!input.harness.allPassed) {
    return 'QUALITY_VERIFIED';
  }
  return 'PAPER_DATA_APPROVED';
}
