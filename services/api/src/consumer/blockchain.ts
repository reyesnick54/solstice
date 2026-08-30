/**
 * Consumer BFF blockchain intelligence dispatch — read-only external chain resources.
 */

import {
  createBlockchainIntelligenceSandbox,
  type BlockchainIntelligenceService,
} from '../../../../packages/sunrey-chain/src/blockchain-intelligence/index.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';

type BlockchainDispatchRequest = {
  readonly method: string;
  readonly path: string;
};

type BlockchainDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

let defaultService: BlockchainIntelligenceService | undefined;

function resolveService(custom?: BlockchainIntelligenceService): BlockchainIntelligenceService {
  if (custom) return custom;
  if (!defaultService) defaultService = createBlockchainIntelligenceSandbox();
  return defaultService;
}

function json(status: number, body: unknown, headers: Record<string, string>): BlockchainDispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): BlockchainDispatchResponse {
  if (isBffError(body)) {
    return json(body.errorCode === 'NOT_FOUND' ? 404 : 400, body, headers);
  }
  return json(okStatus, body, headers);
}

function failure(requestId: string, message: string): BffErrorEnvelope {
  return bffError({
    errorCode: 'VALIDATION',
    category: 'VALIDATION',
    message,
    retryable: false,
    requestId,
  });
}

export function dispatchBlockchain(
  request: BlockchainDispatchRequest,
  requestId: string,
  headers: Record<string, string>,
  intelligence?: BlockchainIntelligenceService,
): BlockchainDispatchResponse | null {
  const { method, path } = request;
  if (!path.startsWith('/api/v1/blockchain')) return null;

  const svc = resolveService(intelligence);

  try {
    if (path === '/api/v1/blockchain/networks' && method === 'GET') {
      return result(
        Object.freeze({
          networks: svc.listNetworks(),
          capabilityMatrix: svc.capabilityMatrix(),
          readOnly: true,
          simulation: true,
        }),
        headers,
      );
    }

    if (path.startsWith('/api/v1/blockchain/networks/') && method === 'GET') {
      const rest = path.slice('/api/v1/blockchain/networks/'.length);
      if (rest.endsWith('/status')) {
        const networkId = rest.slice(0, -'/status'.length);
        const status = svc.networkStatus(networkId);
        return result(Object.freeze({ networkId, status, readOnly: true, simulation: true }), headers);
      }
      if (rest.endsWith('/fees')) {
        const networkId = rest.slice(0, -'/fees'.length);
        const fees = svc.networkFees(networkId);
        return result(Object.freeze({ networkId, fees, readOnly: true, simulation: true }), headers);
      }
      const network = svc.getNetwork(rest);
      if (!network) {
        return result(
          bffError({
            errorCode: 'NOT_FOUND',
            category: 'NOT_FOUND',
            message: `network not found: ${rest}`,
            retryable: false,
            requestId,
          }),
          headers,
        );
      }
      return result(
        Object.freeze({
          network,
          exchangeMetadata: svc.exchangeNetworkMetadata(rest),
          readOnly: true,
          simulation: true,
        }),
        headers,
      );
    }

    if (path.startsWith('/api/v1/blockchain/transactions/') && method === 'GET') {
      const rest = path.slice('/api/v1/blockchain/transactions/'.length);
      const slash = rest.indexOf('/');
      if (slash <= 0) return null;
      const networkId = rest.slice(0, slash);
      const hash = rest.slice(slash + 1);
      const transaction = svc.transaction(networkId, hash);
      return result(
        Object.freeze({ networkId, hash, transaction, readOnly: true, simulation: true }),
        headers,
      );
    }

    if (path === '/api/v1/blockchain/market-quotes' && method === 'GET') {
      const quotes = svc.cryptoMarketQuotes();
      return result(Object.freeze({ quotes, readOnly: true, simulation: true }), headers);
    }

    return result(
      bffError({
        errorCode: 'NOT_FOUND',
        category: 'NOT_FOUND',
        message: 'blockchain route not found',
        retryable: false,
        requestId,
      }),
      headers,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'blockchain request failed';
    return result(failure(requestId, message), headers);
  }
}
