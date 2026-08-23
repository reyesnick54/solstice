import { createHash } from 'node:crypto';

import type { FinancialProposal } from './types.ts';

export function materialTermsHash(input: {
  readonly actionType: string;
  readonly instrument: string;
  readonly sourceAccountId?: string;
  readonly destination: string;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly risk: string;
  readonly fees: readonly { readonly code: string; readonly certainty: string; readonly annualBps?: number }[];
  readonly assumptionSetId: string;
  readonly assumptionAvailability: string;
}): string {
  const payload = JSON.stringify({
    actionType: input.actionType,
    instrument: input.instrument,
    sourceAccountId: input.sourceAccountId ?? null,
    destination: input.destination,
    amountMinorUnits: input.amountMinorUnits,
    currency: input.currency,
    risk: input.risk,
    fees: input.fees.map((fee) => ({
      code: fee.code,
      certainty: fee.certainty,
      annualBps: fee.annualBps ?? null,
    })),
    assumptionSetId: input.assumptionSetId,
    assumptionAvailability: input.assumptionAvailability,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function assertUnchangedMaterialTerms(proposal: FinancialProposal): boolean {
  return (
    materialTermsHash({
      actionType: proposal.actionType,
      instrument: proposal.instrument,
      ...(proposal.sourceAccountId ? { sourceAccountId: proposal.sourceAccountId } : {}),
      destination: proposal.destination,
      amountMinorUnits: proposal.amount.minorUnits,
      currency: proposal.currency,
      risk: proposal.risk,
      fees: proposal.fees,
      assumptionSetId: proposal.assumptions.assumptionSetId,
      assumptionAvailability: proposal.assumptions.availability,
    }) === proposal.materialTermsHash
  );
}
