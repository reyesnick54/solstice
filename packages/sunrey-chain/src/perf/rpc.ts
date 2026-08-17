import { FeeEngine } from '../fees/engine.ts';
import {
  InteropEngine,
  createExternalDevChain,
  developmentExternalChain,
  finalizeForeignHeader,
  isolatedRelayer,
} from '../interop/index.ts';
import { EXTERNAL_DEV_CHAIN_ID } from '../interop/types.ts';
import { developmentEnergyFeed, developmentOracleEngine, developmentProvider } from '../oracle/index.ts';
import { deriveOracleKey, defaultOracleSuiteId } from '../oracle/crypto.ts';
import { ProductiveEconomyEngine } from '../productive/engine.ts';
import { DEV_CLOCK, solarFacility } from '../productive/fixtures.ts';
import { FOUR_VALIDATOR_LABELS } from '../validators/four-validator.ts';
import { caseResult } from './result.ts';
import { elapsedNs, nowNs, summarizeLatency, summarizeThroughput } from './statistics.ts';
import type { BenchCaseResult, RpcEndpoint } from './types.ts';
import { RPC_ENDPOINTS } from './types.ts';

function jsonBytes(value: unknown): number {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)).length;
}

type RpcHandler = () => { readonly ok: boolean; readonly bytes: number };

export type InProcessRpc = {
  readonly handle: (endpoint: RpcEndpoint | 'malformed') => { readonly ok: boolean; readonly bytes: number };
  readonly limits: { readonly maxInflight: number; readonly maxBytes: number };
};

export function createInProcessRpc(): InProcessRpc {
  const fees = new FeeEngine();
  fees.faucet('alice', 1_000_000n);
  const clock = { nowUnix: () => 1_700_000_000n };
  const oracle = developmentOracleEngine(clock);
  const key = deriveOracleKey(oracle.ports, defaultOracleSuiteId(), 'rpc-oracle');
  if (!key.ok) {
    throw new Error(key.error.detail);
  }
  oracle.registerProvider(
    developmentProvider('oracle_rpc', 'PUBLIC_DATA_PROVIDER', key.value.publicKey.publicKeyHex, ['ENERGY_PRODUCTION']),
    key.value.publicKey,
  );
  oracle.registerFeed(developmentEnergyFeed());
  const productive = new ProductiveEconomyEngine(DEV_CLOCK);
  productive.registerObject(solarFacility());
  const interop = new InteropEngine();
  const foreign = createExternalDevChain();
  interop.registerChain(developmentExternalChain(foreign.genesisHash), 'GOVERNANCE');
  interop.activateChain(EXTERNAL_DEV_CHAIN_ID, 'GOVERNANCE');
  const clientId = interop.initializeClient(foreign);
  interop.submitHeader(clientId, finalizeForeignHeader(foreign), isolatedRelayer('relayer-rpc'));

  const handlers: Record<RpcEndpoint, RpcHandler> = {
    block: () => ({ ok: true, bytes: jsonBytes({ height: 1, id: 'blk_1' }) }),
    transaction: () => ({ ok: true, bytes: jsonBytes({ txId: 'tx_1', status: 'FINALIZED' }) }),
    account: () => ({ ok: true, bytes: jsonBytes(fees.accounts.position('alice', 'SUNREY_COIN')) }),
    asset_holdings: () => ({ ok: true, bytes: jsonBytes({ SUNREY_COIN: fees.accounts.position('alice', 'SUNREY_COIN').available.toString() }) }),
    fees: () => ({ ok: true, bytes: jsonBytes(fees.protocolCommitments()) }),
    oracle_facts: () => ({ ok: true, bytes: jsonBytes(oracle.listFacts()) }),
    productive_graph: () => ({ ok: true, bytes: productive.currentGraph().projectionHash.length }),
    validator_set: () => ({ ok: true, bytes: jsonBytes(FOUR_VALIDATOR_LABELS) }),
    interop_client: () => ({
      ok: true,
      bytes: jsonBytes({ clientId, height: interop.clients.get(clientId)?.latestHeight ?? 0n }),
    }),
  };

  const limits = { maxInflight: 64, maxBytes: 32_768 };
  let inflight = 0;
  return {
    limits,
    handle(endpoint) {
      if (endpoint === 'malformed') {
        return { ok: false, bytes: 0 };
      }
      if (inflight >= limits.maxInflight) {
        return { ok: false, bytes: 0 };
      }
      inflight += 1;
      try {
        const result = handlers[endpoint]();
        if (result.bytes > limits.maxBytes) {
          return { ok: false, bytes: 0 };
        }
        return result;
      } finally {
        inflight -= 1;
      }
    },
  };
}

export function measureRpcLoad(input: { readonly requests: number }): readonly BenchCaseResult[] {
  const rpc = createInProcessRpc();
  const byEndpoint: Record<RpcEndpoint, number[]> = {
    block: [],
    transaction: [],
    account: [],
    asset_holdings: [],
    fees: [],
    oracle_facts: [],
    productive_graph: [],
    validator_set: [],
    interop_client: [],
  };
  let errors = 0;
  const started = nowNs();
  for (let i = 0; i < input.requests; i += 1) {
    const endpoint = RPC_ENDPOINTS[i % RPC_ENDPOINTS.length]!;
    const callStarted = nowNs();
    const result = rpc.handle(endpoint);
    byEndpoint[endpoint].push(elapsedNs(callStarted));
    if (!result.ok) {
      errors += 1;
    }
  }
  const durationNs = elapsedNs(started);
  const cases = RPC_ENDPOINTS.map((endpoint) =>
    caseResult('rpc', endpoint, {
      latency: summarizeLatency(byEndpoint[endpoint]),
    }),
  );
  cases.push(
    caseResult('rpc', 'aggregate', {
      throughput: summarizeThroughput({
        submitted: input.requests,
        accepted: input.requests - errors,
        finalized: input.requests - errors,
        rejected: errors,
        durationMs: durationNs / 1_000_000,
      }),
      extras: {
        errorRate: input.requests === 0 ? 0 : errors / input.requests,
        rssBytes: process.memoryUsage().rss,
        cpuUserMs: process.cpuUsage().user / 1000,
      },
    }),
  );
  return cases;
}

export function measureRpcAbuse(input: { readonly requests: number }): readonly BenchCaseResult[] {
  const rpc = createInProcessRpc();
  const samples: number[] = [];
  let rejected = 0;
  const before = process.memoryUsage().rss;
  for (let i = 0; i < input.requests; i += 1) {
    const started = nowNs();
    const result = rpc.handle('malformed');
    samples.push(elapsedNs(started));
    if (!result.ok) {
      rejected += 1;
    }
  }
  const after = process.memoryUsage().rss;
  const collapsed = after > before * 4 && after - before > 64 * 1024 * 1024;
  return [
    caseResult('rpc_abuse', 'malformed_traffic', {
      latency: summarizeLatency(samples),
      extras: {
        rejected,
        protectiveLimitsHeld: rejected === input.requests && !collapsed,
        rssGrowthBytes: after - before,
      },
    }),
  ];
}
