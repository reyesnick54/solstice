export const REGULATED_RECON_SCOPES = [
  'NATIVE_CHAIN',
  'CUSTODY_ATTRIBUTION',
  'EXCHANGE_POSITIONS',
  'WITHDRAWAL_STATE',
  'SETTLEMENT_STATE',
  'FEES',
] as const;
export type RegulatedReconScope = (typeof REGULATED_RECON_SCOPES)[number];

export type RegulatedReconciliationIncident = {
  readonly scope: RegulatedReconScope;
  readonly expected: bigint;
  readonly observed: bigint;
  readonly autoCorrected: false;
};

export type RegulatedReconciliationReport = {
  readonly cadence: 'DAILY' | 'CONTINUOUS';
  readonly matched: boolean;
  readonly incidents: readonly RegulatedReconciliationIncident[];
  readonly autoBalancingEntries: false;
};

export function reconcileRegulatedPositions(input: {
  readonly cadence: 'DAILY' | 'CONTINUOUS';
  readonly nativeChain: bigint;
  readonly custodyAttribution: bigint;
  readonly exchangePositions: bigint;
  readonly withdrawalState: bigint;
  readonly settlementState: bigint;
  readonly fees: bigint;
}): RegulatedReconciliationReport {
  const pairs: readonly { scope: RegulatedReconScope; expected: bigint; observed: bigint }[] = [
    { scope: 'NATIVE_CHAIN', expected: input.nativeChain, observed: input.custodyAttribution },
    {
      scope: 'CUSTODY_ATTRIBUTION',
      expected: input.custodyAttribution,
      observed: input.exchangePositions + input.withdrawalState + input.settlementState + input.fees,
    },
    { scope: 'EXCHANGE_POSITIONS', expected: input.exchangePositions, observed: input.exchangePositions },
    { scope: 'WITHDRAWAL_STATE', expected: input.withdrawalState, observed: input.withdrawalState },
    { scope: 'SETTLEMENT_STATE', expected: input.settlementState, observed: input.settlementState },
    { scope: 'FEES', expected: input.fees, observed: input.fees },
  ];
  const incidents = pairs
    .filter((pair) => pair.expected !== pair.observed)
    .map((pair) =>
      Object.freeze({
        scope: pair.scope,
        expected: pair.expected,
        observed: pair.observed,
        autoCorrected: false as const,
      }),
    );
  return Object.freeze({
    cadence: input.cadence,
    matched: incidents.length === 0,
    incidents: Object.freeze(incidents),
    autoBalancingEntries: false,
  });
}
