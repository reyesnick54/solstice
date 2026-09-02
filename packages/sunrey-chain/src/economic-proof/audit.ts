/**
 * Wave 3 Task 1 — audit of existing duplicate protections before Wave 3 changes.
 *
 * This module documents current-state weaknesses; it does not mutate legacy paths.
 */

export type DuplicateProtectionSurface = {
  readonly surface: string;
  readonly economy: 'HUMAN' | 'PRODUCTIVE' | 'SHARED';
  readonly mechanism: string;
  readonly scope: string;
  readonly weakness: string;
};

export const EXISTING_DUPLICATE_PROTECTIONS: readonly DuplicateProtectionSurface[] = Object.freeze([
  {
    surface: 'HumanContributionRegistry.fingerprint',
    economy: 'HUMAN',
    mechanism: 'DUPLICATE_FINGERPRINT on contribution submit',
    scope: 'Single registry, in-memory',
    weakness: 'No cross-source alias resolution; separate APIs can submit different fingerprints for same event',
  },
  {
    surface: 'HinContributionAdapter.byReceipt',
    economy: 'HUMAN',
    mechanism: 'DUPLICATE_USAGE_RECEIPT',
    scope: 'Receipt id per HIN path',
    weakness: 'Same contribution via PubMed vs ORCID vs university lacks unified canonical event id',
  },
  {
    surface: 'HinEconomicValueEngine.hinReplayKey',
    economy: 'HUMAN',
    mechanism: 'REPLAYED_EVENT',
    scope: 'HIN value product index',
    weakness: 'Replay key is path-specific; not bound to canonical claim fingerprint',
  },
  {
    surface: 'HumanContributionMonetaryBridge.settledReplayKeys',
    economy: 'HUMAN',
    mechanism: 'replayKeyOf(fingerprint, authorizationId, valuationId, policyVersion)',
    scope: 'In-memory settlement book',
    weakness: 'Ephemeral; no durable cross-node enforcement; fingerprint may differ for same event',
  },
  {
    surface: 'HumanContributionMonetaryBridge.settledContributionIds',
    economy: 'HUMAN',
    mechanism: 'Contribution id set',
    scope: 'Per contribution id',
    weakness: 'Different contribution ids for same underlying event can still settle separately',
  },
  {
    surface: 'authorizeIssuance.usedReplayIds',
    economy: 'SHARED',
    mechanism: 'assetId:issuanceClass:replayIdentifier',
    scope: 'AssetSupplyBook in-memory',
    weakness: 'Protects issuance replay, not upstream claim duplication; not durable across crash',
  },
  {
    surface: 'ProductiveEngine.contributionFingerprint',
    economy: 'PRODUCTIVE',
    mechanism: 'V1/V2 productive fingerprint',
    scope: 'Productive claim submit',
    weakness: 'Oracle fact ids in fingerprint can differ when same event observed by multiple providers',
  },
  {
    surface: 'AttributionAccounting.observationFingerprint',
    economy: 'PRODUCTIVE',
    mechanism: 'Stripped fingerprints + replay keys',
    scope: 'Attribution decision path',
    weakness: 'Not unified with human path; cluster corroboration not explicit',
  },
  {
    surface: 'MoonReyProductiveSettlementBook',
    economy: 'PRODUCTIVE',
    mechanism: 'settledFingerprints, settledEventIds, settledValueIds, replayKeyOf',
    scope: 'V2 settlement in-memory',
    weakness: 'Summation risk if multiple claims reach settlement without cluster enforcement',
  },
  {
    surface: 'HumanInformationAnchorCoordinator.bySource',
    economy: 'HUMAN',
    mechanism: 'Source-key dedup for anchors',
    scope: 'Chain anchor scheduling',
    weakness: 'Anchoring dedup ≠ monetization dedup',
  },
  {
    surface: 'EconomicObservation / provider job ids',
    economy: 'SHARED',
    mechanism: 'Per-provider record identity only',
    scope: 'External data fixtures',
    weakness: 'No canonical event clustering; retries create new ids unless fingerprinted',
  },
]);

export const WAVE3_GAPS_ADDRESSED = Object.freeze([
  'canonicalEntityId + alias resolver boundary',
  'canonicalEventId independent of provider record id',
  'observationFingerprint vs corroboration distinction',
  'claimFingerprint for monetization-safe identity',
  'duplicateClusterId grouping',
  'explicit lineage DAG',
  'monetization lock with consumption commitment',
  'challenge state blocking silent monetary execution',
]);
