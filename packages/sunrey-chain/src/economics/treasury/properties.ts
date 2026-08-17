/**
 * Property tests: mixed fund / reserve / authorize / disburse / cancel / return
 * operations must reconcile after every step.
 */

import { ProtocolTreasuryEngine, developmentCycle } from './engine.ts';
import { humanGovernanceActor } from './policy.ts';
import type { TreasuryRefusalCode } from './types.ts';

export type TreasuryPropertyOp =
  | { readonly kind: 'fund'; readonly quantity: bigint }
  | { readonly kind: 'reserve'; readonly quantity: bigint }
  | { readonly kind: 'authorize'; readonly quantity: bigint }
  | { readonly kind: 'reserveQuantity'; readonly quantity: bigint }
  | { readonly kind: 'disburse' }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'return'; readonly quantity: bigint };

export type PropertyStepResult = {
  readonly op: TreasuryPropertyOp;
  readonly accepted: boolean;
  readonly code?: TreasuryRefusalCode;
  readonly reconciled: boolean;
};

const HUMAN = humanGovernanceActor();

export function runTreasuryPropertySequence(
  seed: number,
  length = 16,
): { readonly steps: readonly PropertyStepResult[]; readonly ok: boolean } {
  const engine = new ProtocolTreasuryEngine();
  engine.fund({
    fundingId: 'prop-open',
    source: 'EXPLICIT_APPROVED_GENESIS_ALLOCATION',
    asset: 'SUNREY_COIN',
    reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
    quantity: 10_000n,
    epoch: 0n,
    height: 0n,
    evidenceRef: 'prop:open',
    monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
  });
  engine.proposeBudget(
    {
      budgetId: 'prop-budget',
      asset: 'SUNREY_COIN',
      reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
      purpose: 'PROTOCOL_INFRASTRUCTURE',
      maximumAuthorizedQuantity: 5_000n,
      cycle: developmentCycle('prop-cycle'),
      recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
      evidenceRefs: ['prop:budget'],
      governanceProposalRef: 'gov:prop',
    },
    HUMAN,
  );
  engine.approveBudget('prop-budget', HUMAN);

  let intentSeq = 0;
  let lastIntent: string | null = null;
  let lastReservation: string | null = null;
  const steps: PropertyStepResult[] = [];
  let cursor = seed >>> 0;

  const next = (): number => {
    cursor = (Math.imul(1664525, cursor) + 1013904223) >>> 0;
    return cursor;
  };

  const kinds: TreasuryPropertyOp['kind'][] = [
    'fund',
    'reserve',
    'authorize',
    'reserveQuantity',
    'disburse',
    'cancel',
    'return',
  ];

  for (let i = 0; i < length; i += 1) {
    const kind = kinds[next() % kinds.length]!;
    const quantity = BigInt((next() % 400) + 1);
    let accepted = true;
    let code: TreasuryRefusalCode | undefined;
    if (kind === 'fund') {
      const result = engine.fund({
        fundingId: `prop-fund-${i}`,
        source: 'GOVERNED_TRANSFER_TO_PROTOCOL_TREASURY',
        asset: 'SUNREY_COIN',
        reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
        quantity,
        epoch: BigInt(i),
        height: BigInt(i * 3),
        evidenceRef: `prop:fund:${i}`,
        monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
      });
      accepted = result.ok;
      if (!result.ok) {
        code = result.code;
      }
    } else if (kind === 'authorize' || kind === 'reserve') {
      intentSeq += 1;
      const intentId = `prop-intent-${intentSeq}`;
      const created = engine.createIntent(
        {
          intentId,
          budgetId: 'prop-budget',
          recipient: 'acct.provider',
          recipientClass: 'PROTOCOL_SERVICE_PROVIDER',
          asset: 'SUNREY_COIN',
          quantity,
          purpose: 'PROTOCOL_INFRASTRUCTURE',
          expirationEpoch: 1_000n,
        },
        HUMAN,
      );
      if (!created.ok) {
        accepted = false;
        code = created.code;
      } else {
        const approved = engine.approveIntent(intentId, HUMAN);
        accepted = approved.ok;
        if (!approved.ok) {
          code = approved.code;
        } else {
          lastIntent = intentId;
        }
      }
    } else if (kind === 'reserveQuantity') {
      if (!lastIntent) {
        accepted = false;
        code = 'UNKNOWN_INTENT';
      } else {
        const reserved = engine.reserve(lastIntent, HUMAN);
        accepted = reserved.ok;
        if (!reserved.ok) {
          code = reserved.code;
        } else {
          lastReservation = reserved.value.reservationId;
        }
      }
    } else if (kind === 'disburse') {
      if (!lastIntent) {
        accepted = false;
        code = 'UNKNOWN_INTENT';
      } else {
        const finalized = engine.finalize(lastIntent, `finality-${i}`, HUMAN);
        accepted = finalized.ok;
        if (!finalized.ok) {
          code = finalized.code;
        } else {
          lastIntent = null;
          lastReservation = null;
        }
      }
    } else if (kind === 'cancel') {
      if (!lastReservation) {
        accepted = false;
        code = 'UNKNOWN_RESERVATION';
      } else {
        const cancelled = engine.cancelReservation(lastReservation, HUMAN);
        accepted = cancelled.ok;
        if (!cancelled.ok) {
          code = cancelled.code;
        } else {
          lastIntent = null;
          lastReservation = null;
        }
      }
    } else {
      const returned = engine.returnUnused({
        fundingId: `prop-return-${i}`,
        source: 'AUTHORIZED_RETURN_REFUND_UNUSED',
        asset: 'SUNREY_COIN',
        reserveClass: 'PROTOCOL_OPERATIONS_RESERVE',
        quantity,
        epoch: BigInt(i),
        height: BigInt(i * 3),
        evidenceRef: `prop:return:${i}`,
        monetaryPolicyVersion: 'sunrey.monetary.constitution.v1',
      });
      accepted = returned.ok;
      if (!returned.ok) {
        code = returned.code;
      }
    }
    const reconciled = engine.reconcile().ok;
    steps.push(
      Object.freeze({
        op: Object.freeze({ kind, quantity }) as TreasuryPropertyOp,
        accepted,
        ...(code ? { code } : {}),
        reconciled,
      }),
    );
    if (!reconciled) {
      return { steps, ok: false };
    }
  }
  return { steps, ok: steps.every((row) => row.reconciled) };
}

export function treasuryPropertiesHold(samples = 8): boolean {
  for (let seed = 1; seed <= samples; seed += 1) {
    if (!runTreasuryPropertySequence(seed * 77, 20).ok) {
      return false;
    }
  }
  return true;
}
