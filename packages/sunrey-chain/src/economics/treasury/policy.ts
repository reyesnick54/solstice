/**
 * Versioned protocol treasury and budget policy fixtures.
 *
 * Production limits remain UNCONFIGURED. Historical budgets bind the
 * policy version active at authorization and are not silently
 * reinterpreted by later policy changes.
 */

import { PRODUCTION_PARAMETER_UNCONFIGURED } from '../types.ts';
import {
  PROTOCOL_RESERVE_CLASSES,
  PROTOCOL_TREASURY_CLASS,
  PROTOCOL_TREASURY_OWNER,
  PROTOCOL_TREASURY_POLICY_VERSION_ID,
  PROTOCOL_TREASURY_SCHEMA_VERSION,
  TREASURY_FUNDING_SOURCES,
  TREASURY_PURPOSE_CLASSES,
  TREASURY_RECIPIENT_CLASSES,
  type ProtocolTreasuryPolicy,
  type TreasuryBudgetPolicy,
  type TreasurySpendingConstraints,
} from './types.ts';

export function unconfiguredSpendingConstraints(): TreasurySpendingConstraints {
  return Object.freeze({
    perTransactionLimit: PRODUCTION_PARAMETER_UNCONFIGURED,
    perRecipientLimit: PRODUCTION_PARAMETER_UNCONFIGURED,
    perReserveLimit: PRODUCTION_PARAMETER_UNCONFIGURED,
    perCycleLimit: PRODUCTION_PARAMETER_UNCONFIGURED,
    globalCycleLimit: PRODUCTION_PARAMETER_UNCONFIGURED,
    productionLimitsConfigured: false,
  });
}

export function developmentTreasuryPolicy(
  policyVersion: string = PROTOCOL_TREASURY_POLICY_VERSION_ID,
): ProtocolTreasuryPolicy {
  return Object.freeze({
    schemaVersion: PROTOCOL_TREASURY_SCHEMA_VERSION,
    policyVersion,
    owner: PROTOCOL_TREASURY_OWNER,
    classification: PROTOCOL_TREASURY_CLASS,
    distinctFromFiatTreasuryPackage: true,
    fiatTreasuryOwner: 'packages/treasury',
    allowedAssets: Object.freeze(['SUNREY_COIN', 'MOONREY_COIN'] as const),
    allowedReserveClasses: PROTOCOL_RESERVE_CLASSES,
    allowedFundingSources: TREASURY_FUNDING_SOURCES,
    allowedPurposeClasses: TREASURY_PURPOSE_CLASSES,
    allowedRecipientClasses: TREASURY_RECIPIENT_CLASSES,
    spendingConstraints: unconfiguredSpendingConstraints(),
    treasuryMintForbidden: true,
    customerAssetClaimForbidden: true,
    fiatRepresentationForbidden: true,
    pricePegForbidden: true,
    algorithmicPegForbidden: true,
    guaranteedValueForbidden: true,
    guaranteedLiquidityForbidden: true,
    guaranteedRedemptionForbidden: true,
    aiMayAnalyze: true,
    aiMayVote: false,
    aiMayApprove: false,
    aiMayAuthorizeTransfer: false,
    aiMayActivateReservePolicy: false,
    emergencyCannotRewriteSupply: true,
    emergencyCannotConfiscateCustomerAssets: true,
    emergencyCannotRollbackFinality: true,
    emergencyCannotChangeMonetaryPolicy: true,
    emergencyCannotMint: true,
    moonreyHoldingsAreNotProductiveContribution: true,
    productionTreasuryInactive: true,
    productionLimitsConfigured: false,
  });
}

export function rehearsalTreasuryPolicy(): ProtocolTreasuryPolicy {
  return developmentTreasuryPolicy('sunrey.protocol.treasury.rehearsal.v1');
}

export function productionCandidateTreasuryPolicy(): ProtocolTreasuryPolicy {
  return developmentTreasuryPolicy('sunrey.protocol.treasury.production-candidate.v1');
}

export function developmentBudgetPolicy(
  parent = PROTOCOL_TREASURY_POLICY_VERSION_ID,
): TreasuryBudgetPolicy {
  return Object.freeze({
    policyVersion: `${parent}.budget`,
    parentTreasuryPolicyVersion: parent,
    allowedReserveClasses: PROTOCOL_RESERVE_CLASSES,
    cycleLengthEpochs: 8n,
    perProposalLimit: PRODUCTION_PARAMETER_UNCONFIGURED,
    perCycleLimit: PRODUCTION_PARAMETER_UNCONFIGURED,
    recipientRules: TREASURY_RECIPIENT_CLASSES,
    purposeRules: TREASURY_PURPOSE_CLASSES,
    approvalRequirements: Object.freeze({
      humanGovernanceRequired: true,
      aiApprovalRejected: true,
      emergencyHeightenedForEmergencyReserve: true,
      rootOfTrustKeysRequired: true,
    }),
    activationBoundaries: Object.freeze({
      minActivationEpoch: 0n,
      maxActivationEpoch: PRODUCTION_PARAMETER_UNCONFIGURED,
    }),
  });
}

export function humanGovernanceActor(
  actorId = 'gov.human.treasury',
  extras: { readonly emergencyHeightened?: boolean; readonly keyRefs?: readonly string[] } = {},
) {
  return Object.freeze({
    kind: 'HUMAN' as const,
    actorId,
    governanceAuthorized: true,
    emergencyHeightened: extras.emergencyHeightened === true,
    rootOfTrustKeyRefs: extras.keyRefs ?? Object.freeze(['rot.governance.treasury.1']),
  });
}

export function aiActor(actorId = 'gov.ai.preparer') {
  return Object.freeze({
    kind: 'AI' as const,
    actorId,
    governanceAuthorized: false,
    emergencyHeightened: false,
    rootOfTrustKeyRefs: Object.freeze([] as const),
  });
}
