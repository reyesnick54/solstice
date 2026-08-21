/**
 * Provider-neutral custody deposit and withdrawal sequences.
 * AI cannot skip steps. Execution Authority is required before the
 * adapter is invoked. Unverified callbacks never credit product state.
 */

import type { NativeCustodyAssetId } from '../native-assets.ts';
import { rejectAiCustodyBypass, rejectUnverifiedDepositCredit } from './contract.ts';
import type { CustodyProviderContract, ProviderDepositLifecycle } from './contract.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult } from './types.ts';

export const WITHDRAWAL_WORKFLOW_STEPS = [
  'user_request',
  'authentication',
  'authorization',
  'wallet_ownership',
  'compliance_travel_rule',
  'risk',
  'approval_step_up',
  'execution_authority',
  'custody_adapter',
  'provider_network_state',
  'settlement_reconciliation',
  'evidence',
] as const;
export type WithdrawalWorkflowStep = (typeof WITHDRAWAL_WORKFLOW_STEPS)[number];

export const DEPOSIT_WORKFLOW_STEPS = [
  'detected',
  'signature_verified',
  'confirming',
  'confirmed',
  'credited',
  'reorg_review',
  'failed',
  'review',
] as const;
export type DepositWorkflowStep = (typeof DEPOSIT_WORKFLOW_STEPS)[number];

export type WithdrawalWorkflowRecord = {
  readonly withdrawalId: string;
  readonly completedSteps: readonly WithdrawalWorkflowStep[];
  readonly blockedAt: WithdrawalWorkflowStep | null;
  readonly aiBypassAttempted: boolean;
  readonly adapterInvoked: boolean;
  readonly postedFiatLedger: false;
};

export type DepositWorkflowRecord = {
  readonly depositRef: string;
  readonly lifecycle: ProviderDepositLifecycle;
  readonly signatureVerified: boolean;
  readonly creditedCustomerProduct: boolean;
  readonly requiresNetworkEvidence: true;
};

export function runWithdrawalWorkflow(input: {
  readonly withdrawalId: string;
  readonly authenticated: boolean;
  readonly authorized: boolean;
  readonly walletOwned: boolean;
  readonly travelRuleSatisfied: boolean;
  readonly riskCleared: boolean;
  readonly stepUpApproved: boolean;
  readonly executionAuthorityPresent: boolean;
  readonly actorKind: 'HUMAN' | 'AI_AGENT';
  readonly adapter: CustodyProviderContract;
  readonly walletId: string;
  readonly destination: string;
  readonly assetId: NativeCustodyAssetId;
  readonly quantity: bigint;
}): CustodyCandidateResult<WithdrawalWorkflowRecord> {
  if (input.actorKind === 'AI_AGENT') {
    const refused = rejectAiCustodyBypass();
    return candidateErr(refused.error.code, refused.error.message);
  }
  const completed: WithdrawalWorkflowStep[] = ['user_request'];
  const gates: readonly { readonly step: WithdrawalWorkflowStep; readonly ok: boolean }[] = [
    { step: 'authentication', ok: input.authenticated },
    { step: 'authorization', ok: input.authorized },
    { step: 'wallet_ownership', ok: input.walletOwned },
    { step: 'compliance_travel_rule', ok: input.travelRuleSatisfied },
    { step: 'risk', ok: input.riskCleared },
    { step: 'approval_step_up', ok: input.stepUpApproved },
    { step: 'execution_authority', ok: input.executionAuthorityPresent },
  ];
  for (const gate of gates) {
    if (!gate.ok) {
      return candidateOk(
        Object.freeze({
          withdrawalId: input.withdrawalId,
          completedSteps: Object.freeze(completed),
          blockedAt: gate.step,
          aiBypassAttempted: false,
          adapterInvoked: false,
          postedFiatLedger: false,
        }),
      );
    }
    completed.push(gate.step);
  }
  const created = input.adapter.createWithdrawal({
    withdrawalId: input.withdrawalId,
    walletId: input.walletId,
    destination: input.destination,
    assetId: input.assetId,
    quantity: input.quantity,
  });
  if (!created.ok) {
    return created;
  }
  completed.push('custody_adapter', 'provider_network_state', 'settlement_reconciliation', 'evidence');
  return candidateOk(
    Object.freeze({
      withdrawalId: input.withdrawalId,
      completedSteps: Object.freeze([...completed]),
      blockedAt: null,
      aiBypassAttempted: false,
      adapterInvoked: true,
      postedFiatLedger: false,
    }),
  );
}

export function runDepositWorkflow(input: {
  readonly depositRef: string;
  readonly signatureVerified: boolean;
  readonly networkFinalized: boolean;
  readonly reorgSuspected: boolean;
  readonly mappingKnown: boolean;
}): CustodyCandidateResult<DepositWorkflowRecord> {
  if (!input.signatureVerified) {
    const refused = rejectUnverifiedDepositCredit();
    return candidateErr(refused.error.code, refused.error.message);
  }
  if (!input.mappingKnown) {
    return candidateOk(
      Object.freeze({
        depositRef: input.depositRef,
        lifecycle: 'review' as const,
        signatureVerified: true,
        creditedCustomerProduct: false,
        requiresNetworkEvidence: true,
      }),
    );
  }
  if (input.reorgSuspected) {
    return candidateOk(
      Object.freeze({
        depositRef: input.depositRef,
        lifecycle: 'reorg_review' as const,
        signatureVerified: true,
        creditedCustomerProduct: false,
        requiresNetworkEvidence: true,
      }),
    );
  }
  if (!input.networkFinalized) {
    return candidateOk(
      Object.freeze({
        depositRef: input.depositRef,
        lifecycle: 'confirming' as const,
        signatureVerified: true,
        creditedCustomerProduct: false,
        requiresNetworkEvidence: true,
      }),
    );
  }
  return candidateOk(
    Object.freeze({
      depositRef: input.depositRef,
      lifecycle: 'confirmed' as const,
      signatureVerified: true,
      creditedCustomerProduct: false,
      requiresNetworkEvidence: true,
    }),
  );
}

export function creditDepositAfterConfirmation(
  record: DepositWorkflowRecord,
): CustodyCandidateResult<DepositWorkflowRecord> {
  if (record.lifecycle !== 'confirmed' || record.signatureVerified !== true) {
    return rejectUnverifiedDepositCredit();
  }
  return candidateOk(
    Object.freeze({
      ...record,
      lifecycle: 'credited' as const,
      creditedCustomerProduct: true,
    }),
  );
}
