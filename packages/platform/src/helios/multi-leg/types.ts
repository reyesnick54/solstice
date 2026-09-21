/**
 * HELIOS multi-leg strategy proposal types.
 * Proposals coordinate legs; Execution Authority remains external.
 */

export const HELIOS_MULTI_LEG_PROPOSAL_STATES = [
  'DRAFT',
  'QUALIFIED',
  'SUBMITTED',
  'PARTIALLY_FILLED',
  'FILLED',
  'UNWIND_REQUIRED',
  'UNWOUND',
  'FAILED',
  'EXPIRED',
] as const;
export type HeliosMultiLegProposalState = (typeof HELIOS_MULTI_LEG_PROPOSAL_STATES)[number];

export type HeliosMultiLegProposalLeg = {
  readonly legIndex: number;
  readonly instrumentId: string;
  readonly direction: 'BUY' | 'SELL';
  readonly relativeWeightBps: number;
};

export type HeliosMultiLegStrategyProposal = {
  readonly proposalId: string;
  readonly strategyCapsuleId: string;
  readonly pairId: string;
  readonly legs: readonly HeliosMultiLegProposalLeg[];
  readonly expectedHedgeRelationship: string;
  readonly evidence: readonly string[];
  readonly invalidatingConditions: readonly string[];
  readonly state: HeliosMultiLegProposalState;
  readonly grantsFinancialEffect: false;
  readonly sizingAuthority: 'EXTERNAL_META_ALLOCATOR';
};
