/**
 * Explorer backend contract. Canonical indexer remains packages/sunrey-explorer.
 * This module names the stable read API Lovable can consume later.
 */

export const EXPLORER_API_ROUTES = [
  'GET /v1/status',
  'GET /v1/network/status',
  'GET /v1/blocks',
  'GET /v1/blocks/{id}',
  'GET /v1/transactions',
  'GET /v1/transactions/{id}',
  'GET /v1/accounts/{id}',
  'GET /v1/validators',
  'GET /v1/assets',
  'GET /v1/fees',
] as const;

export const EXPLORER_OWNER = 'packages/sunrey-explorer';
export const EXPLORER_AUTHORITATIVE = false;

export type ExplorerNetworkStatistics = {
  readonly height: number;
  readonly finalizedHeight: number | null;
  readonly validatorCount: number;
  readonly mempoolSize: number;
  readonly environment: 'simulation';
  readonly authoritative: false;
};

export function explorerStatistics(input: {
  readonly height: number;
  readonly validatorCount: number;
  readonly mempoolSize: number;
  readonly finalizedHeight?: number | null;
}): ExplorerNetworkStatistics {
  return {
    height: input.height,
    finalizedHeight: input.finalizedHeight ?? null,
    validatorCount: input.validatorCount,
    mempoolSize: input.mempoolSize,
    environment: 'simulation',
    authoritative: false,
  };
}
