import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

import { buildGenesis } from '../../sunrey-chain/src/testnet/genesis.ts';
import { IsolatedRangeNetwork } from './network.ts';
import {
  RANGE_CHAIN_ID,
  RANGE_GENESIS_LABEL,
  RANGE_NETWORK_ID,
  RANGE_PROTOCOL_VERSION,
  RANGE_SCHEMA_VERSION,
  type RangeActor,
} from './types.ts';

export const RANGE_VALIDATOR_IDS = [
  'val_range_a',
  'val_range_b',
  'val_range_c',
  'val_range_d',
  'val_range_e',
  'val_range_f',
  'val_range_g',
] as const;

export type RangeEnvironment = {
  readonly schemaVersion: typeof RANGE_SCHEMA_VERSION;
  readonly protocolVersion: typeof RANGE_PROTOCOL_VERSION;
  readonly networkId: typeof RANGE_NETWORK_ID;
  readonly chainId: typeof RANGE_CHAIN_ID;
  readonly seed: number;
  readonly sourceCommit: string;
  readonly testnetGenesis: string;
  readonly actors: readonly RangeActor[];
  readonly network: IsolatedRangeNetwork;
  readonly credentials: 'TEST_ONLY';
  readonly observability: { readonly alerts: string[]; readonly metrics: Map<string, bigint>; readonly securityLog: string[] };
};

export function sourceCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown-source-commit';
  }
}

export function rangeGenesisHash(seed: number): string {
  const genesis = buildGenesis();
  return createHash('sha256')
    .update(RANGE_GENESIS_LABEL)
    .update('\0')
    .update(genesis.genesisHash)
    .update('\0')
    .update(String(seed))
    .digest('hex');
}

export function defaultActors(): readonly RangeActor[] {
  const validators: RangeActor[] = RANGE_VALIDATOR_IDS.map((actorId) => ({
    actorId,
    role: 'VALIDATOR',
    adversarial: false,
    votingPower: 1n,
    controllerId: `operator.${actorId}`,
  }));
  return Object.freeze([
    ...validators,
    { actorId: 'sentry.mesh', role: 'SENTRY', adversarial: false },
    { actorId: 'rpc.public.1', role: 'RPC', adversarial: false },
    { actorId: 'explorer.range', role: 'EXPLORER', adversarial: false },
    { actorId: 'faucet.range', role: 'FAUCET', adversarial: false },
    { actorId: 'exchange.range', role: 'EXCHANGE', adversarial: false },
    { actorId: 'custody.range', role: 'CUSTODY', adversarial: false },
    { actorId: 'oracle.range.a', role: 'ORACLE_PROVIDER', adversarial: false, controllerId: 'controller.oracle.a' },
    { actorId: 'oracle.range.b', role: 'ORACLE_PROVIDER', adversarial: false, controllerId: 'controller.oracle.b' },
    { actorId: 'oracle.range.c', role: 'ORACLE_PROVIDER', adversarial: false, controllerId: 'controller.oracle.a' },
    { actorId: 'machine.buyer', role: 'MACHINE_ACTOR', adversarial: false },
    { actorId: 'relayer.isolated', role: 'RELAYER', adversarial: true },
    { actorId: 'obs.range', role: 'OBSERVABILITY', adversarial: false },
    { actorId: 'peer.malicious.1', role: 'MALICIOUS_PEER', adversarial: true },
    { actorId: 'operator.human', role: 'HUMAN_OPERATOR', adversarial: false },
  ]);
}

export function createRangeEnvironment(seed = 57): RangeEnvironment {
  process.env.SUNREY_FIXTURE_ENV ??= 'local';
  return {
    schemaVersion: RANGE_SCHEMA_VERSION,
    protocolVersion: RANGE_PROTOCOL_VERSION,
    networkId: RANGE_NETWORK_ID,
    chainId: RANGE_CHAIN_ID,
    seed,
    sourceCommit: sourceCommit(),
    testnetGenesis: rangeGenesisHash(seed),
    actors: defaultActors(),
    network: new IsolatedRangeNetwork(seed),
    credentials: 'TEST_ONLY',
    observability: {
      alerts: [],
      metrics: new Map(),
      securityLog: [],
    },
  };
}

export function recordAlert(env: RangeEnvironment, code: string): void {
  env.observability.alerts.push(code);
  env.observability.securityLog.push(code);
  const current = env.observability.metrics.get(code) ?? 0n;
  env.observability.metrics.set(code, current + 1n);
}
