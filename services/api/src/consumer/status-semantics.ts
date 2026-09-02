/**
 * Wave 8 — client-safe product status semantics.
 * Do not tell the frontend something is complete before it actually is.
 */

/** Blockchain transaction lifecycle exposed to consumers. */
export const BLOCKCHAIN_TX_STATUSES = [
  'SUBMITTED',
  'PENDING',
  'INCLUDED',
  'EXECUTED',
  'FINALIZED',
  'REJECTED',
] as const;
export type BlockchainTxStatus = (typeof BLOCKCHAIN_TX_STATUSES)[number];

/** Economic claim lifecycle exposed to consumers. */
export const ECONOMIC_CLAIM_STATUSES = [
  'OBSERVED',
  'VERIFYING',
  'VERIFIED',
  'CLAIM_CREATED',
  'VALUED',
  'AWAITING_GOVERNANCE',
  'AUTHORIZED',
  'FINALIZED',
  'CHALLENGED',
] as const;
export type EconomicClaimStatus = (typeof ECONOMIC_CLAIM_STATUSES)[number];

const BLOCKCHAIN_FINAL = new Set<BlockchainTxStatus>(['FINALIZED', 'REJECTED']);
const CLAIM_FINAL = new Set<EconomicClaimStatus>(['FINALIZED', 'CHALLENGED']);

export function isBlockchainTxFinal(status: BlockchainTxStatus): boolean {
  return BLOCKCHAIN_FINAL.has(status);
}

export function isEconomicClaimFinal(status: EconomicClaimStatus): boolean {
  return CLAIM_FINAL.has(status);
}

/** Map custody/wallet finality to Wave 8 blockchain semantics. */
export function mapWalletFinalityToBlockchain(finality: string): BlockchainTxStatus {
  switch (finality) {
    case 'PENDING':
      return 'PENDING';
    case 'BROADCAST':
      return 'SUBMITTED';
    case 'CONFIRMING':
      return 'INCLUDED';
    case 'FINALIZED':
      return 'FINALIZED';
    case 'FAILED':
      return 'REJECTED';
    case 'REVIEW':
      return 'PENDING';
    default:
      return 'PENDING';
  }
}

/** Map internal HIN verification to economic claim semantics. */
export function mapHinVerificationToClaimStatus(verification: string): EconomicClaimStatus {
  switch (verification) {
    case 'OBSERVED':
      return 'OBSERVED';
    case 'PENDING_VERIFICATION':
    case 'IN_REVIEW':
      return 'VERIFYING';
    case 'VERIFIED':
      return 'VERIFIED';
    case 'VALUED':
      return 'VALUED';
    case 'DISPUTED':
      return 'CHALLENGED';
    case 'REJECTED':
      return 'CHALLENGED';
    default:
      return 'OBSERVED';
  }
}

/** Map productive claim internal status to economic claim semantics. */
export function mapProductiveClaimStatus(internal: string): EconomicClaimStatus {
  switch (internal) {
    case 'SUBMITTED':
      return 'CLAIM_CREATED';
    case 'VERIFIED':
      return 'VERIFIED';
    case 'VALUED':
    case 'GPUV_COMPUTED':
      return 'VALUED';
    case 'AWAITING_GOVERNANCE':
      return 'AWAITING_GOVERNANCE';
    case 'AUTHORIZED':
      return 'AUTHORIZED';
    case 'SETTLED':
    case 'FINALIZED':
      return 'FINALIZED';
    case 'DISPUTED':
    case 'CHALLENGED':
      return 'CHALLENGED';
    case 'OBSERVED':
      return 'OBSERVED';
    default:
      return 'OBSERVED';
  }
}

export function clientSafeCompletionLabel(
  kind: 'blockchain' | 'claim',
  status: string,
): { readonly complete: boolean; readonly clientStatus: string } {
  if (kind === 'blockchain') {
    const mapped = mapWalletFinalityToBlockchain(status);
    return Object.freeze({
      complete: isBlockchainTxFinal(mapped),
      clientStatus: mapped,
    });
  }
  const mapped =
    status === 'VERIFIED' || status === 'OBSERVED'
      ? mapHinVerificationToClaimStatus(status)
      : mapProductiveClaimStatus(status);
  return Object.freeze({
    complete: isEconomicClaimFinal(mapped),
    clientStatus: mapped,
  });
}
