/**
 * HELIOS ALT02 data rights firewall qualification.
 */

export const HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED =
  'HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED' as const;

export const HELIOS_ALT02_DATA_RIGHTS_FIREWALL_BLOCKED =
  'HELIOS_ALT02_DATA_RIGHTS_FIREWALL_BLOCKED' as const;

export type Alt02QualificationChecks = {
  readonly unknownLicenseBlocked: boolean;
  readonly missingManifestBlocked: boolean;
  readonly purposeMustBeExplicit: boolean;
  readonly expiredStopsNewIngestion: boolean;
  readonly historicalFollowsRetention: boolean;
  readonly derivedFeatureGateBlocksNonPermitted: boolean;
  readonly prohibitedAcquisitionAttestationRequired: boolean;
  readonly aggregateScopeRequired: boolean;
  readonly evidenceSealedOnDeny: boolean;
  readonly providerRegistryBridgePresent: boolean;
};

export type Alt02QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED
    | typeof HELIOS_ALT02_DATA_RIGHTS_FIREWALL_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const LABELS: Record<keyof Alt02QualificationChecks, string> = {
  unknownLicenseBlocked: 'unknown_license_blocked',
  missingManifestBlocked: 'missing_manifest_blocked',
  purposeMustBeExplicit: 'purpose_must_be_explicit',
  expiredStopsNewIngestion: 'expired_stops_new_ingestion',
  historicalFollowsRetention: 'historical_follows_retention',
  derivedFeatureGateBlocksNonPermitted: 'aaf_blocks_non_permitted_features',
  prohibitedAcquisitionAttestationRequired: 'prohibited_acquisition_attestation',
  aggregateScopeRequired: 'aggregate_scope_required',
  evidenceSealedOnDeny: 'evidence_sealed_on_deny',
  providerRegistryBridgePresent: 'provider_registry_bridge',
};

export function evaluateAlt02DataRightsFirewallQualification(
  checks: Alt02QualificationChecks,
): Alt02QualificationResult {
  const blockers: string[] = [];
  for (const [key, pass] of Object.entries(checks) as [keyof Alt02QualificationChecks, boolean][]) {
    if (!pass) {
      blockers.push(LABELS[key]);
    }
  }

  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_ALT02_DATA_RIGHTS_FIREWALL_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }

  return Object.freeze({
    marker: HELIOS_ALT02_DATA_RIGHTS_FIREWALL_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
