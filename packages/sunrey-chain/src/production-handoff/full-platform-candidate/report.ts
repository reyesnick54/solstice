/**
 * Human-readable full-platform candidate report. Does not activate
 * production and does not claim licensure.
 */

import type { FullPlatformCandidateBundle } from './types.ts';
import type { FullPlatformQualificationDecision } from './types.ts';
import type { FullPlatformCandidateReport } from './types.ts';
import type { FullPlatformBurnInResult } from './burn-in.ts';

export function buildFullPlatformCandidateReport(input: {
  readonly bundle: FullPlatformCandidateBundle;
  readonly decision: FullPlatformQualificationDecision;
  readonly burnIn: FullPlatformBurnInResult;
  readonly firewallOverallState: string;
}): FullPlatformCandidateReport {
  return Object.freeze({
    schemaVersion: input.bundle.schemaVersion,
    toolVersion: 'sunrey-ops/production/full-platform/1',
    identity: Object.freeze({
      bundleId: input.bundle.bundleId,
      sourceCommit: input.bundle.sourceCommit,
      fixtureVersion: input.bundle.fixtureVersion,
      seed: input.bundle.seed,
      profile: input.bundle.profile,
      bundleHash: input.bundle.bundleHash,
      burnInCanonicalHash: input.bundle.burnInCanonicalHash,
    }),
    checkpoints: input.burnIn.runtime.checkpoints,
    matrix: input.decision.matrix,
    counters: input.decision.counters,
    posture: input.decision.posture,
    firewall: Object.freeze({
      decisionHash: input.decision.firewallDecisionHash,
      overallState: input.firewallOverallState,
      productionActivated: false,
      overriddenByBundle: false,
    }),
    qualification: input.decision.bundleState,
    openBlockers: input.decision.openBlockers,
    productionActive: false,
  });
}

export function formatFullPlatformReport(report: FullPlatformCandidateReport): string {
  const p = report.posture;
  const c = report.counters;
  return [
    'SunRey full-platform production-candidate report',
    `bundleHash=${report.identity.bundleHash}`,
    `qualification=${report.qualification}`,
    `firewall=${report.firewall.overallState}`,
    '',
    `ARCHITECTURE_INTEGRITY=${String(p.architectureIntegrity).toUpperCase()}`,
    `FULL_PLATFORM_BURN_IN_PASSED=${String(p.fullPlatformBurnInPassed).toUpperCase()}`,
    `LEDGER_BALANCED=${String(p.ledgerBalanced).toUpperCase()}`,
    `SUNREY_SUPPLY_RECONCILED=${String(p.sunreySupplyReconciled).toUpperCase()}`,
    `MOONREY_SUPPLY_RECONCILED=${String(p.moonreySupplyReconciled).toUpperCase()}`,
    `CROSS_ASSET_CUSTODY_ISOLATED=${String(p.crossAssetCustodyIsolated).toUpperCase()}`,
    `DUPLICATE_PAYMENT_EFFECTS=${c.duplicatePaymentEffects}`,
    `DUPLICATE_WITHDRAWAL_EFFECTS=${c.duplicateWithdrawalEffects}`,
    `REFERENCE_PRICE_DIRECT_MINTS=${c.referencePriceDirectMints}`,
    `AI_AUTHORITY_VIOLATIONS=${c.aiAuthorityViolations}`,
    `RAW_CREDENTIAL_LEAKS=${c.rawCredentialLeaks}`,
    `PUBLIC_CHAIN_PII_LEAKS=${c.publicChainPiiLeaks}`,
    `ADVERSARIAL_INVARIANT_BREACHES=${c.adversarialInvariantBreaches}`,
    `REAL_BANK_CONNECTED=${String(p.realBankConnected).toUpperCase()}`,
    `REAL_KYC_PROVIDER_CONNECTED=${String(p.realKycProviderConnected).toUpperCase()}`,
    `REAL_CUSTODY_PROVIDER_CONNECTED=${String(p.realCustodyProviderConnected).toUpperCase()}`,
    `REAL_ORACLE_PROVIDER_CONNECTED=${String(p.realOracleProviderConnected).toUpperCase()}`,
    `LIVE_FLAGS_ENABLED=${String(p.liveFlagsEnabled).toUpperCase()}`,
    `PRODUCTION_ECONOMIC_PARAMETERS_CONFIGURED=${String(p.productionEconomicParametersConfigured).toUpperCase()}`,
    `PRODUCTION_ACTIVE=${String(p.productionActive).toUpperCase()}`,
  ].join('\n');
}
