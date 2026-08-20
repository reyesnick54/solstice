/**
 * Full-platform handoff gate.
 *
 * PRODUCTION_CANDIDATE_REVIEW_READY means engineering evidence passed
 * and the bundle is ready for human / external review. It does not
 * authorize production. The Chunk 143 firewall cannot be overridden.
 * AI cannot change status, mark external evidence, or flip LIVE flags.
 */

import { evaluateProductionEconomicActivation } from '../../economics/production-activation/firewall.ts';
import { currentRepositorySnapshot } from '../../economics/production-activation/fixtures.ts';
import { assembleCandidateBundle, type BundleHashInput } from './bundle.ts';
import { runFullPlatformBurnIn, type FullPlatformBurnInResult } from './burn-in.ts';
import { campaignBlocksBundle, runProductionSafetySmokeCampaign } from './campaign.ts';
import { currentExternalEvidenceInventory } from './limitations.ts';
import { buildReadinessMatrix, engineeringRowsPassed } from './matrix.ts';
import { countersOf } from './runtime.ts';
import type { FullPlatformBundleState, FullPlatformQualificationDecision } from './types.ts';

const NON_HUMAN = new Set(['AI', 'S3M', 'GROK', 'AGENT', 'AUTOMATION', 'SERVICE']);

export function qualifyFullPlatformCandidate(input: {
  readonly hashes: BundleHashInput;
  readonly burnIn?: FullPlatformBurnInResult;
  readonly architectureIntegrity?: boolean;
  readonly actorKind?: 'HUMAN' | 'AI' | 'S3M' | 'GROK' | 'AGENT' | 'AUTOMATION' | 'SERVICE';
  readonly markExternalPresent?: boolean;
  readonly markLegalPassed?: boolean;
  readonly markGovernancePassed?: boolean;
  readonly forceReviewReady?: boolean;
}): FullPlatformQualificationDecision {
  const bundle = assembleCandidateBundle(input.hashes);
  const firewall = evaluateProductionEconomicActivation(currentRepositorySnapshot());
  const burnIn = input.burnIn ?? runFullPlatformBurnIn({ profile: input.hashes.profile, seed: input.hashes.seed });
  const campaign = runProductionSafetySmokeCampaign(burnIn.runtime);
  const architectureIntegrity = input.architectureIntegrity ?? true;
  const matrix = buildReadinessMatrix({
    burnIn,
    campaign,
    architectureIntegrity,
    firewallBlocks: firewall.productionActivated === false,
  });
  const blockers: string[] = [];

  if (!architectureIntegrity) {
    blockers.push('architecture-integrity-required');
  }
  if (!burnIn.persistenceRestarted) blockers.push('persistence-restart-failed');
  if (!burnIn.paymentRecovered) blockers.push('payment-recovery-failed');
  if (!burnIn.dualAssetIsolated) blockers.push('custody-isolation-failed');
  if (!burnIn.exchangeSettled) blockers.push('exchange-dvp-open');
  if (!burnIn.humanDeduped) blockers.push('human-path-duplicate');
  if (!burnIn.productiveDeduped) blockers.push('productive-path-duplicate');
  if (!burnIn.ledgerBalanced) blockers.push('ledger-unbalanced');
  if (!burnIn.sunreyReconciled) blockers.push('sunrey-supply-mismatch');
  if (!burnIn.moonreyReconciled) blockers.push('moonrey-supply-mismatch');
  if (!burnIn.chainDidNotInventFinality) blockers.push('invented-finality');
  if (!burnIn.privacyClean) blockers.push('privacy-scan-failed');
  if (campaignBlocksBundle(campaign)) blockers.push('adversarial-invariant-breach');
  if (bundle.firewallDecisionHash !== firewall.decisionId) blockers.push('bundle-cannot-override-firewall');
  if (firewall.productionActivated) blockers.push('firewall-production-activated');
  if (input.forceReviewReady) blockers.push('force-review-ready-forbidden');
  if (input.markExternalPresent) blockers.push('external-evidence-cannot-be-fabricated');
  if (input.markLegalPassed) blockers.push('legal-review-cannot-be-marked-by-engineering');
  if (input.markGovernancePassed) blockers.push('human-governance-cannot-be-marked-by-automation');
  if (input.actorKind && NON_HUMAN.has(input.actorKind)) {
    blockers.push(`ai-cannot-change-status:${input.actorKind}`);
  }

  const engineeringFailed = blockers.some((row) =>
    [
      'architecture-integrity-required',
      'persistence-restart-failed',
      'payment-recovery-failed',
      'custody-isolation-failed',
      'exchange-dvp-open',
      'human-path-duplicate',
      'productive-path-duplicate',
      'ledger-unbalanced',
      'sunrey-supply-mismatch',
      'moonrey-supply-mismatch',
      'invented-finality',
      'privacy-scan-failed',
      'adversarial-invariant-breach',
    ].includes(row),
  );
  const burnInPassed =
    burnIn.persistenceRestarted &&
    burnIn.paymentRecovered &&
    burnIn.dualAssetIsolated &&
    burnIn.exchangeSettled &&
    burnIn.humanDeduped &&
    burnIn.productiveDeduped &&
    burnIn.ledgerBalanced &&
    burnIn.sunreyReconciled &&
    burnIn.moonreyReconciled &&
    burnIn.privacyClean &&
    campaign.invariantBreaches === 0;

  blockers.push('awaiting-production-parameters');
  blockers.push('awaiting-external-provider-evidence');
  blockers.push('awaiting-security-audit');
  blockers.push('awaiting-legal-regulatory-evidence');
  blockers.push('awaiting-human-governance');
  blockers.push('production-provider-connectivity-disabled');
  blockers.push('human-activation-authorization-absent');

  const engineeringPassed = architectureIntegrity && burnInPassed && engineeringRowsPassed(matrix) && !engineeringFailed;
  const bundleState = deriveState({
    incomplete: input.hashes.burnInCanonicalHash.length === 0,
    engineeringFailed,
    burnInPassed,
    engineeringPassed,
  });

  return Object.freeze({
    bundleState,
    bundleHash: bundle.bundleHash,
    firewallDecisionHash: firewall.decisionId,
    engineeringPassed,
    burnInPassed,
    architectureIntegrity,
    matrix,
    externalEvidence: currentExternalEvidenceInventory(),
    openBlockers: Object.freeze(blockers),
    counters: countersOf(burnIn.runtime),
    posture: Object.freeze({
      architectureIntegrity,
      fullPlatformBurnInPassed: burnInPassed,
      ledgerBalanced: burnIn.ledgerBalanced,
      sunreySupplyReconciled: burnIn.sunreyReconciled,
      moonreySupplyReconciled: burnIn.moonreyReconciled,
      crossAssetCustodyIsolated: burnIn.dualAssetIsolated,
      realBankConnected: false,
      realKycProviderConnected: false,
      realCustodyProviderConnected: false,
      realOracleProviderConnected: false,
      liveFlagsEnabled: false,
      productionEconomicParametersConfigured: false,
      productionActive: false,
    }),
    productionActivated: false,
    aiCanChangeStatus: false,
    bundleOverridesFirewall: false,
  });
}

export function refuseAiStatusChange(actorKind: string): string {
  return `ai-cannot-change-status:${actorKind}`;
}

export function refuseForceActivation(): string {
  return 'no-force-admin-testonly-skip-emergency-bypass';
}

function deriveState(input: {
  readonly incomplete: boolean;
  readonly engineeringFailed: boolean;
  readonly burnInPassed: boolean;
  readonly engineeringPassed: boolean;
}): FullPlatformBundleState {
  if (input.incomplete) return 'INCOMPLETE';
  if (input.engineeringFailed) return input.burnInPassed ? 'ENGINEERING_FAILED' : 'BURN_IN_FAILED';
  if (!input.burnInPassed) return 'BURN_IN_FAILED';
  if (input.engineeringPassed) return 'PRODUCTION_CANDIDATE_REVIEW_READY';
  return 'ENGINEERING_RECONCILED';
}
