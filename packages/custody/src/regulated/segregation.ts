export type CustodySegregationVerification = {
  readonly chainNativeHoldings: bigint;
  readonly custodyVaultAttribution: bigint;
  readonly customerOwnershipAttribution: bigint;
  readonly exchangeObligations: bigint;
  readonly pendingWithdrawals: bigint;
  readonly lockedAssets: bigint;
  readonly fees: bigint;
  readonly matched: boolean;
  readonly autoBalancingEntries: false;
  readonly incident: string | null;
};

export function verifyCustomerAssetSegregation(input: {
  readonly chainNativeHoldings: bigint;
  readonly custodyVaultAttribution: bigint;
  readonly customerOwnershipAttribution: bigint;
  readonly exchangeObligations: bigint;
  readonly pendingWithdrawals: bigint;
  readonly lockedAssets: bigint;
  readonly fees: bigint;
}): CustodySegregationVerification {
  const attributed =
    input.customerOwnershipAttribution +
    input.exchangeObligations +
    input.pendingWithdrawals +
    input.lockedAssets +
    input.fees;
  const matched =
    input.chainNativeHoldings === input.custodyVaultAttribution && input.custodyVaultAttribution === attributed;
  return Object.freeze({
    ...input,
    matched,
    autoBalancingEntries: false,
    incident: matched ? null : 'SEGREGATION_MISMATCH',
  });
}
