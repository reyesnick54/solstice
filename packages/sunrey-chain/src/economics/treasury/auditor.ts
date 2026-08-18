/**
 * sunrey-economics treasury verify — reconcile funding, reservations,
 * disbursements, returns, balances, and policy versions.
 */

import { ProtocolTreasuryEngine } from './engine.ts';
import { developmentTreasuryPolicy } from './policy.ts';
import { treasuryPropertiesHold } from './properties.ts';
import { allTreasuryStressHold } from './stress.ts';
import type { TreasuryReconciliation } from './types.ts';

export type TreasuryVerifyReport = {
  readonly command: 'treasury verify';
  readonly ok: boolean;
  readonly reconciliation: TreasuryReconciliation;
  readonly propertiesHold: boolean;
  readonly stressHold: boolean;
  readonly treasuryMintUnavailable: true;
  readonly customerAssetsUnreachable: true;
  readonly productionLimitsConfigured: false;
};

export function verifyTreasury(engine: ProtocolTreasuryEngine = new ProtocolTreasuryEngine(developmentTreasuryPolicy())): TreasuryVerifyReport {
  const reconciliation = engine.reconcile();
  return Object.freeze({
    command: 'treasury verify',
    ok: reconciliation.ok && treasuryPropertiesHold(4) && allTreasuryStressHold(),
    reconciliation,
    propertiesHold: treasuryPropertiesHold(4),
    stressHold: allTreasuryStressHold(),
    treasuryMintUnavailable: true,
    customerAssetsUnreachable: true,
    productionLimitsConfigured: false,
  });
}

export function showTreasuryPolicy() {
  const policy = developmentTreasuryPolicy();
  return Object.freeze({
    policyVersion: policy.policyVersion,
    owner: policy.owner,
    classification: policy.classification,
    distinctFromFiatTreasuryPackage: policy.distinctFromFiatTreasuryPackage,
    allowedAssets: policy.allowedAssets,
    allowedReserveClasses: policy.allowedReserveClasses,
    allowedFundingSources: policy.allowedFundingSources,
    productionTreasuryInactive: policy.productionTreasuryInactive,
    productionLimitsConfigured: policy.productionLimitsConfigured,
    treasuryMintForbidden: policy.treasuryMintForbidden,
    pricePegForbidden: policy.pricePegForbidden,
    aiMayApprove: policy.aiMayApprove,
  });
}
