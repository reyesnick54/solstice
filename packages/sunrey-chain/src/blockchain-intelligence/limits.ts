/**
 * Wave 3 query limits and abuse protection for external chain intelligence.
 */

export const BLOCKCHAIN_QUERY_LIMITS = Object.freeze({
  maxBlockRange: 100,
  maxEventResults: 50,
  maxTransactionBatch: 20,
  maxResponseBytes: 256_000,
  maxConcurrentLookups: 8,
  defaultTimeoutMs: 5_000,
  cacheTtlMs: 30_000,
  staleTtlMs: 300_000,
  rateLimitPerMinute: 60,
  maxHexLength: 128,
  maxStringLength: 512,
});

export type QueryLimitRejection = {
  readonly code: 'QUERY_LIMIT_EXCEEDED' | 'INVALID_PARAMETER' | 'UNAUTHORIZED_CONTRACT';
  readonly message: string;
};

export function validateBlockRange(fromBlock: number, toBlock: number): QueryLimitRejection | null {
  if (!Number.isInteger(fromBlock) || !Number.isInteger(toBlock) || fromBlock < 0 || toBlock < fromBlock) {
    return { code: 'INVALID_PARAMETER', message: 'invalid block range' };
  }
  if (toBlock - fromBlock > BLOCKCHAIN_QUERY_LIMITS.maxBlockRange) {
    return {
      code: 'QUERY_LIMIT_EXCEEDED',
      message: `block range exceeds max ${BLOCKCHAIN_QUERY_LIMITS.maxBlockRange}`,
    };
  }
  return null;
}

export function validateHex(value: string, fieldName: string): QueryLimitRejection | null {
  if (value.length > BLOCKCHAIN_QUERY_LIMITS.maxHexLength) {
    return { code: 'INVALID_PARAMETER', message: `${fieldName} too long` };
  }
  if (!/^(0x)?[0-9a-fA-F]*$/.test(value)) {
    return { code: 'INVALID_PARAMETER', message: `${fieldName} invalid hex` };
  }
  return null;
}

/** Allowlisted read-only contract targets for oracle/reference feeds. */
export const ALLOWED_READ_CONTRACTS = Object.freeze({
  'ethereum-mainnet': Object.freeze([
    '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD Chainlink
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC token metadata reads
  ]),
});

export function isAllowedReadContract(networkId: string, contractAddress: string): boolean {
  const allowed = ALLOWED_READ_CONTRACTS[networkId as keyof typeof ALLOWED_READ_CONTRACTS];
  if (!allowed) return false;
  return allowed.some((a) => a.toLowerCase() === contractAddress.toLowerCase());
}
