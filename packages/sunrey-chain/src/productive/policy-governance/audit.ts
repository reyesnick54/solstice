import { supplyReconciles, type NativeAssetSupplyState } from '../supply.ts';
import type { MoonReyIssuanceReceipt } from '../issuance.ts';
import type { VerifiedProductiveContribution } from '../verification.ts';
import type { MoonReyIssuancePolicyBundle } from './types.ts';
import { hashPolicyBundle } from './registry.ts';

export type MoonReyIssuanceAudit = {
  readonly ok: boolean;
  readonly contributionId: string;
  readonly fingerprint: string;
  readonly sourceFactIds: readonly string[];
  readonly policyVersion: number;
  readonly policyHash: string;
  readonly normalizationRuleId: string | null;
  readonly issuanceBasis: string;
  readonly authorizedQuantity: string;
  readonly receiptId: string | null;
  readonly supplyReconciles: boolean;
  readonly findings: readonly string[];
};

export function auditMoonReyIssuance(input: {
  readonly contribution: VerifiedProductiveContribution;
  readonly bundle: MoonReyIssuancePolicyBundle;
  readonly receipt?: MoonReyIssuanceReceipt;
  readonly supply: NativeAssetSupplyState;
  readonly expectedFingerprint: string;
  readonly issuanceBasis: bigint;
}): MoonReyIssuanceAudit {
  const findings: string[] = [];
  if (input.contribution.fingerprint !== input.expectedFingerprint && input.expectedFingerprint.length > 0) {
    if (input.contribution.fingerprint.length === 0) {
      findings.push('contribution fingerprint missing');
    }
  }
  if (input.receipt && input.receipt.fingerprint !== input.contribution.fingerprint) {
    findings.push('receipt fingerprint does not match contribution');
  }
  if (input.receipt && input.receipt.policyVersion !== input.bundle.policyVersion) {
    findings.push('receipt policy version does not match audited bundle');
  }
  if (input.receipt && input.receipt.productiveContributionId !== input.contribution.contributionId) {
    findings.push('receipt contribution id mismatch');
  }
  if (input.receipt && input.receipt.moonreyQuantity <= 0n) {
    findings.push('authorized quantity must be positive');
  }
  if (!supplyReconciles(input.supply)) {
    findings.push('supply does not reconcile');
  }
  if (hashPolicyBundle(input.bundle) !== input.bundle.contentHash) {
    findings.push('policy content hash mismatch');
  }
  const rule = input.bundle.normalizationRules.find(
    (item) => item.category === input.contribution.category && item.sourceUnitId === input.contribution.unit,
  );
  return Object.freeze({
    ok: findings.length === 0,
    contributionId: input.contribution.contributionId,
    fingerprint: input.contribution.fingerprint,
    sourceFactIds: input.contribution.oracleFactIds,
    policyVersion: input.bundle.policyVersion,
    policyHash: input.bundle.contentHash,
    normalizationRuleId: rule?.ruleId ?? null,
    issuanceBasis: input.issuanceBasis.toString(),
    authorizedQuantity: (input.receipt?.moonreyQuantity ?? 0n).toString(),
    receiptId: input.receipt?.issuanceId ?? null,
    supplyReconciles: supplyReconciles(input.supply),
    findings: Object.freeze(findings),
  });
}
