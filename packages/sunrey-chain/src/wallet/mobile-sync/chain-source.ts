/**
 * Canonical chain source for mobile sync.
 *
 * Reads finalized height, balances, and finality from Chunk 93 RPC
 * interfaces. Uses endpoint pools for submission failover. Safe retry
 * is by canonical transaction ID.
 */

import {
  RpcEndpointPool,
  RpcHealthRouter,
  developmentEndpointPool,
  fixtureEndpoint,
} from '../../public-data-plane/routing.ts';
import { PUBLIC_RELEASE_VERSION, publicNetworkStatus } from '../../public-data-plane/status.ts';
import type { FinalityState, RpcEndpoint, SubmissionEdgeResponse } from '../../public-data-plane/types.ts';
import type { PublicNetworkStatusView } from './types.ts';

export type CanonicalTxRecord = {
  readonly transactionId: string;
  readonly state: FinalityState;
  readonly height: number | null;
  readonly finalized: boolean;
};

export class CanonicalChainSource {
  readonly networkId: string;
  readonly chainId: string;
  readonly pool: RpcEndpointPool;
  readonly router: RpcHealthRouter;
  private height: number;
  private readonly txs = new Map<string, CanonicalTxRecord>();
  private readonly nonces = new Map<string, string>();
  private readonly balances = new Map<string, { available: string; reserved: string; locked: string; assetId: string }>();

  constructor(input: {
    readonly networkId: string;
    readonly chainId: string;
    readonly pool?: RpcEndpointPool;
    readonly height?: number;
  }) {
    this.networkId = input.networkId;
    this.chainId = input.chainId;
    this.pool = input.pool ?? developmentEndpointPool();
    this.router = new RpcHealthRouter(this.pool);
    this.height = input.height ?? 40;
  }

  finalizedHeight(): number {
    return this.height;
  }

  advance(delta = 1): number {
    this.height += delta;
    for (const endpoint of this.pool.list()) {
      if (endpoint.health === 'HEALTHY' || endpoint.health === 'DEGRADED') {
        this.pool.mark(endpoint.endpointId, {
          finalizedHeight: this.height,
          networkFinalizedHeight: this.height,
        });
      }
    }
    return this.height;
  }

  setBalance(accountId: string, assetId: string, available: string, reserved = '0', locked = '0'): void {
    this.balances.set(accountId, { assetId, available, reserved, locked });
  }

  balance(accountId: string): { assetId: string; available: string; reserved: string; locked: string } | undefined {
    return this.balances.get(accountId);
  }

  observeNonce(accountId: string, nonce: string): void {
    this.nonces.set(accountId, nonce);
  }

  nonce(accountId: string): string {
    return this.nonces.get(accountId) ?? '0';
  }

  submit(transactionId: string): SubmissionEdgeResponse {
    const existing = this.txs.get(transactionId);
    if (existing) {
      return Object.freeze({
        transactionId,
        state: 'ALREADY_KNOWN',
        finalized: false,
        mempoolAcceptanceIsFinality: false,
        privateKeyReceived: false,
      });
    }
    const endpoint = this.routeSubmission();
    if (!endpoint) {
      return Object.freeze({
        transactionId,
        state: 'TEMPORARILY_UNAVAILABLE',
        finalized: false,
        mempoolAcceptanceIsFinality: false,
        privateKeyReceived: false,
      });
    }
    this.txs.set(transactionId, {
      transactionId,
      state: 'IN_MEMPOOL',
      height: null,
      finalized: false,
    });
    return Object.freeze({
      transactionId,
      state: 'ACCEPTED_FOR_MEMPOOL',
      finalized: false,
      mempoolAcceptanceIsFinality: false,
      privateKeyReceived: false,
    });
  }

  finalize(transactionId: string): CanonicalTxRecord {
    const height = this.advance(1);
    const record: CanonicalTxRecord = Object.freeze({
      transactionId,
      state: 'FINALIZED',
      height,
      finalized: true,
    });
    this.txs.set(transactionId, record);
    return record;
  }

  finality(transactionId: string): CanonicalTxRecord {
    return (
      this.txs.get(transactionId) ?? {
        transactionId,
        state: 'UNKNOWN',
        height: null,
        finalized: false,
      }
    );
  }

  routeSubmission(): RpcEndpoint | null {
    return this.router.route({
      requestId: `sub.${this.height}`,
      method: 'tx.submit',
      path: '/v1/tx',
      requestClass: 'TRANSACTION_SUBMISSION',
      identity: {
        kind: 'API_KEY',
        networkIdentity: 'mobile-sync',
        apiKeyId: 'mobile-sync',
        grantsFinancialAuthority: false,
      },
      payloadBytes: 256,
      costUnits: 4,
      requiresArchive: false,
      mutationEligibility: true,
      nowUtc: '2026-08-18T00:00:00.000Z',
    });
  }

  markEndpoint(endpointId: string, health: RpcEndpoint['health']): void {
    this.pool.mark(endpointId, {
      health,
      synced: health === 'HEALTHY' || health === 'DEGRADED',
    });
  }

  networkStatus(): PublicNetworkStatusView {
    const publicStatus = publicNetworkStatus({
      networkId: this.networkId,
      chainId: this.chainId,
      latestFinalizedHeight: this.height,
    });
    const healthy = this.pool.list().some((endpoint) => endpoint.health === 'HEALTHY');
    const any = this.pool.list().some((endpoint) => endpoint.health !== 'DOWN');
    return Object.freeze({
      networkId: this.networkId,
      chainId: this.chainId,
      release: publicStatus.releaseVersion ?? PUBLIC_RELEASE_VERSION,
      finalizedHeight: this.height,
      rpcStatus: healthy ? 'HEALTHY' : any ? 'FAILOVER' : 'DOWN',
      environment: 'simulation',
    });
  }

  restart(): void {
    this.txs.clear();
  }
}

export { developmentEndpointPool, fixtureEndpoint };
