/**
 * Wallet fee estimates. Execution revalidates material changes.
 * Estimates are never a settlement promise.
 */

export type FeeLine = {
  readonly code: 'NETWORK' | 'PROVIDER' | 'SUNREY';
  readonly amountMinorUnits: string;
  readonly estimate: true;
  readonly description: string;
};

export type WalletFeeQuote = {
  readonly networkFee: FeeLine;
  readonly providerFee: FeeLine;
  readonly sunreyFee: FeeLine;
  readonly totalEstimateMinorUnits: string;
  readonly estimate: true;
  readonly settlementTimePromise: null;
};

const MATERIAL_CHANGE_BPS = 2000n;

export function estimateWalletFees(input: {
  readonly amountMinorUnits: bigint;
  readonly networkId: string;
  readonly sunreyFeeMinorUnits?: bigint;
}): WalletFeeQuote {
  const network = input.networkId === 'SUNREY_CHAIN' ? 10_000n : 25_000n;
  const provider = input.networkId === 'SUNREY_CHAIN' ? 0n : 15_000n;
  const sunrey = input.sunreyFeeMinorUnits ?? 0n;
  return Object.freeze({
    networkFee: line('NETWORK', network, 'Network fee estimate'),
    providerFee: line('PROVIDER', provider, 'Provider fee estimate'),
    sunreyFee: line('SUNREY', sunrey, 'SunRey fee if configured'),
    totalEstimateMinorUnits: (network + provider + sunrey).toString(),
    estimate: true,
    settlementTimePromise: null,
  });
}

export function feeChangedMaterially(quoted: bigint, current: bigint): boolean {
  if (quoted === 0n) {
    return current > 0n;
  }
  const delta = current > quoted ? current - quoted : quoted - current;
  return delta * 10_000n >= quoted * MATERIAL_CHANGE_BPS;
}

function line(code: FeeLine['code'], amount: bigint, description: string): FeeLine {
  return Object.freeze({
    code,
    amountMinorUnits: amount.toString(),
    estimate: true,
    description,
  });
}
