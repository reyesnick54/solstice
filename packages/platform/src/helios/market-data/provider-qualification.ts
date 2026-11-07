import type { ProductionMarketDataStatus } from './taxonomy.ts';

export type MarketDataProviderProductionEvidence = {
  readonly providerId: string;
  readonly credentialConfigured: boolean;
  readonly contractOrLicenseRef: string | null;
  readonly entitlementEvidenceRef: string | null;
  readonly dataUsePolicyRef: string | null;
  readonly conformancePassed: boolean;
  readonly gapRecoveryPassed: boolean;
  readonly clockValidationPassed: boolean;
  readonly chaosTestPassed: boolean;
  readonly externalConnectivityVerified: boolean;
  readonly secretValuePresent: false;
};

export type ProviderQualificationDecision = {
  readonly providerId: string;
  readonly status: ProductionMarketDataStatus;
  readonly liveShadowEligible: boolean;
  readonly blockers: readonly string[];
};

const REQUIRED_FOR_READONLY_LIVE: (keyof MarketDataProviderProductionEvidence)[] = [
  'credentialConfigured',
  'conformancePassed',
  'gapRecoveryPassed',
  'clockValidationPassed',
  'chaosTestPassed',
];

const REQUIRED_FOR_PRODUCTION_RESEARCH: (keyof MarketDataProviderProductionEvidence)[] = [
  ...REQUIRED_FOR_READONLY_LIVE,
];

function evidenceMissing(
  evidence: MarketDataProviderProductionEvidence,
  key: keyof MarketDataProviderProductionEvidence,
): boolean {
  const value = evidence[key];
  if (key === 'credentialConfigured' || key.endsWith('Passed')) {
    return value !== true;
  }
  if (key === 'externalConnectivityVerified') {
    return value !== true;
  }
  return typeof value !== 'string' || value.trim().length === 0;
}

export function decideProviderMarketDataStatus(
  evidence: MarketDataProviderProductionEvidence,
): ProviderQualificationDecision {
  const blockers: string[] = [];

  if (!evidence.providerId.trim()) {
    blockers.push('provider_id missing');
  }

  let status: ProductionMarketDataStatus = 'REGISTERED';

  const sandboxReady =
    evidence.conformancePassed &&
    evidence.gapRecoveryPassed &&
    evidence.clockValidationPassed &&
    evidence.chaosTestPassed;

  if (sandboxReady) {
    status = 'SANDBOX_QUALIFIED';
  }

  const readonlyLiveReady =
    sandboxReady &&
    evidence.credentialConfigured &&
    evidence.contractOrLicenseRef !== null &&
    evidence.entitlementEvidenceRef !== null &&
    evidence.dataUsePolicyRef !== null;

  if (readonlyLiveReady) {
    for (const key of REQUIRED_FOR_READONLY_LIVE) {
      if (evidenceMissing(evidence, key)) {
        blockers.push(`readonly_live: missing ${key}`);
      }
    }
    if (evidence.externalConnectivityVerified) {
      status = 'READONLY_LIVE_QUALIFIED';
    } else {
      blockers.push('readonly_live: external connectivity not verified — cannot claim live-qualified');
    }
  } else if (evidence.credentialConfigured && !evidence.externalConnectivityVerified) {
    blockers.push('credential present but live qualification requires verified connectivity and contract evidence');
  }

  if (status === 'READONLY_LIVE_QUALIFIED') {
    for (const key of REQUIRED_FOR_PRODUCTION_RESEARCH) {
      if (evidenceMissing(evidence, key)) {
        blockers.push(`production_research: missing ${key}`);
      }
    }
    if (blockers.length === 0) {
      status = 'PRODUCTION_RESEARCH_QUALIFIED';
    }
  }

  const liveShadowEligible =
    status === 'READONLY_LIVE_QUALIFIED' || status === 'PRODUCTION_RESEARCH_QUALIFIED';

  return Object.freeze({
    providerId: evidence.providerId,
    status,
    liveShadowEligible,
    blockers: Object.freeze(blockers),
  });
}

/** Fixture evidence for simulation qualification — not live-qualified. */
export function fixtureSandboxProviderEvidence(providerId: string): MarketDataProviderProductionEvidence {
  return Object.freeze({
    providerId,
    credentialConfigured: false,
    contractOrLicenseRef: 'fixture:license/catalog-only',
    entitlementEvidenceRef: 'fixture:entitlement/sandbox',
    dataUsePolicyRef: 'fixture:policy/research-simulation',
    conformancePassed: true,
    gapRecoveryPassed: true,
    clockValidationPassed: true,
    chaosTestPassed: true,
    externalConnectivityVerified: false,
    secretValuePresent: false,
  });
}
