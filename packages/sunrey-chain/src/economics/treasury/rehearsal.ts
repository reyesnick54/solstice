/**
 * Chunk 70 launch-rehearsal extension: rehearsal-only treasury units.
 *
 * Production treasury remains inactive.
 */

import { disposeFeeV2, developmentFeeDispositionPolicyV2 } from '../../fees/v2/disposition.ts';
import { ProtocolTreasuryEngine, developmentCycle } from './engine.ts';
import { humanGovernanceActor, rehearsalTreasuryPolicy } from './policy.ts';
import { REHEARSAL_ONLY } from '../types.ts';

export type ProtocolTreasuryRehearsalResult = {
  readonly units: typeof REHEARSAL_ONLY;
  readonly productionTreasuryInactive: true;
  readonly feeFunding: boolean;
  readonly budgetCreated: boolean;
  readonly approvedReservation: boolean;
  readonly disbursement: boolean;
  readonly cancellation: boolean;
  readonly emergencyReserveWorkflow: boolean;
  readonly reconciliation: boolean;
  readonly supplyUnchanged: true;
};

export function rehearseProtocolTreasury(): ProtocolTreasuryRehearsalResult {
  const engine = new ProtocolTreasuryEngine(rehearsalTreasuryPolicy());
  const human = humanGovernanceActor('rehearsal.human', {
    keyRefs: ['rot.rehearsal.treasury.1'],
  });
  const emergency = humanGovernanceActor('rehearsal.emergency', {
    emergencyHeightened: true,
    keyRefs: ['rot.rehearsal.treasury.1', 'rot.rehearsal.treasury.2'],
  });

  const funded = engine.fund({
    fundingId: 'rehearsal-genesis',
    source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
    asset: 'SUNREY_COIN',
    reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
    quantity: 1_000n,
    epoch: 0n,
    height: 0n,
    evidenceRef: 'rehearsal:genesis',
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
  });
  const fee = engine.applyFeeDispositionV2(
    disposeFeeV2(developmentFeeDispositionPolicyV2(), 'SUNREY_COIN', 400n),
    'rehearsal-fee',
    1n,
    10n,
  );
  engine.fund({
    fundingId: 'rehearsal-emergency-fund',
    source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
    asset: 'SUNREY_COIN',
    reserveClass: 'EMERGENCY_PROTOCOL_RESERVE',
    quantity: 200n,
    epoch: 0n,
    height: 0n,
    evidenceRef: 'rehearsal:emergency',
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
  });

  const budget = engine.proposeBudget(
    {
      budgetId: 'rehearsal-budget',
      asset: 'SUNREY_COIN',
      reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
      purpose: 'PROTOCOL_INFRASTRUCTURE',
      maximumAuthorizedQuantity: 300n,
      cycle: developmentCycle('rehearsal-cycle'),
      recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
      evidenceRefs: ['rehearsal:budget'],
      governanceProposalRef: 'gov:rehearsal',
    },
    human,
  );
  const approvedBudget = budget.ok ? engine.approveBudget(budget.value.budgetId, human) : budget;
  const intent = approvedBudget.ok
    ? engine.createIntent(
        {
          intentId: 'rehearsal-intent',
          budgetId: 'rehearsal-budget',
          recipient: 'rehearsal.provider',
          recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
          asset: 'SUNREY_COIN',
          quantity: 100n,
          purpose: 'PROTOCOL_INFRASTRUCTURE',
          expirationEpoch: 64n,
        },
        human,
      )
    : approvedBudget;
  const approvedIntent = intent.ok ? engine.approveIntent(intent.value.intentId, human) : intent;
  const reserved = approvedIntent.ok ? engine.reserve(approvedIntent.value.intentId, human) : approvedIntent;
  const finalized = reserved.ok ? engine.finalize(reserved.value.intentId, 'rehearsal-finality-1', human) : reserved;

  const cancelIntent = engine.createIntent(
    {
      intentId: 'rehearsal-cancel',
      budgetId: 'rehearsal-budget',
      recipient: 'rehearsal.provider',
      recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
      asset: 'SUNREY_COIN',
      quantity: 50n,
      purpose: 'PROTOCOL_INFRASTRUCTURE',
      expirationEpoch: 64n,
    },
    human,
  );
  const cancelApproved = cancelIntent.ok ? engine.approveIntent(cancelIntent.value.intentId, human) : cancelIntent;
  const cancelReserved = cancelApproved.ok ? engine.reserve(cancelApproved.value.intentId, human) : cancelApproved;
  const cancelled =
    cancelReserved.ok && 'reservationId' in cancelReserved.value
      ? engine.cancelReservation(cancelReserved.value.reservationId, human)
      : cancelReserved;

  const emergencyBudget = engine.proposeBudget(
    {
      budgetId: 'rehearsal-emergency',
      asset: 'SUNREY_COIN',
      reserveClass: 'EMERGENCY_PROTOCOL_RESERVE',
      purpose: 'SECURITY_RESPONSE',
      maximumAuthorizedQuantity: 80n,
      cycle: developmentCycle('rehearsal-emergency-cycle'),
      recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
      evidenceRefs: ['rehearsal:emergency-budget'],
      governanceProposalRef: 'gov:rehearsal-emergency',
    },
    emergency,
  );
  const emergencyApproved = emergencyBudget.ok ? engine.approveBudget(emergencyBudget.value.budgetId, emergency) : emergencyBudget;
  const emergencyIntent = emergencyApproved.ok
    ? engine.createIntent(
        {
          intentId: 'rehearsal-emergency-intent',
          budgetId: 'rehearsal-emergency',
          recipient: 'rehearsal.security',
          recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
          asset: 'SUNREY_COIN',
          quantity: 40n,
          purpose: 'SECURITY_RESPONSE',
          expirationEpoch: 64n,
        },
        emergency,
      )
    : emergencyApproved;
  const emergencyAuth = emergencyIntent.ok ? engine.approveIntent(emergencyIntent.value.intentId, emergency) : emergencyIntent;
  const emergencyReserved = emergencyAuth.ok ? engine.reserve(emergencyAuth.value.intentId, emergency) : emergencyAuth;
  const emergencyFinal = emergencyReserved.ok
    ? engine.finalize(emergencyReserved.value.intentId, 'rehearsal-emergency-finality', emergency)
    : emergencyReserved;

  return Object.freeze({
    units: REHEARSAL_ONLY,
    productionTreasuryInactive: true,
    feeFunding: funded.ok && fee.ok,
    budgetCreated: approvedBudget.ok,
    approvedReservation: reserved.ok,
    disbursement: finalized.ok,
    cancellation: cancelled.ok,
    emergencyReserveWorkflow: emergencyFinal.ok,
    reconciliation: engine.reconcile().ok,
    supplyUnchanged: true,
  });
}
