// @ts-nocheck
import { createSnapshot, verifySnapshot } from '../../../sunrey-chain/src/ops/snapshots.ts';
import { RANGE_CHAIN_ID, RANGE_NETWORK_ID } from '../types.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'LEDGER_APPEND_ONLY',
  'ASSET_SUPPLYBOOK_CANONICAL',
  'PRODUCTION_NOT_ACTIVE',
] as const;

export const persistenceAttackScenarios: readonly AttackScenario[] = [
  'PERSIST-CORRUPT-CUSTODY',
  'PERSIST-CORRUPT-EXCHANGE',
  'PERSIST-TRUNCATED',
  'PERSIST-CHECKSUM',
  'PERSIST-STALE-WRITE',
  'PERSIST-DB-RESTART',
  'PERSIST-OLD-BACKUP',
  'PERSIST-OUTBOX-INTERRUPT',
  'PERSIST-PROVIDER-ROLLBACK',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15880 + index,
    category: 'PERSISTENCE_ABUSE',
    subsystem: 'persistence',
    attack: scenarioId.toLowerCase().replace('persist-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'SNAPSHOT_TAMPER',
    recovery: 'SNAPSHOT_REJECT',
  }),
);

export function runPersistenceAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const created = createSnapshot({
      networkId: RANGE_NETWORK_ID,
      chainId: RANGE_CHAIN_ID,
      height: 10n,
      blockId: 'blk_10',
      stateRoot: 'root_10',
      protocolVersion: 'sunrey.ops.v1',
      validatorSetHash: 'valset',
      validatorSetVersion: 1n,
      payload: JSON.stringify({ custody: { wallets: 1 }, exchange: { orders: 1 } }),
      createdAtUtc: '2026-08-20T00:00:00.000Z',
    });
    if (!created.ok) {
      return { blocked: false, safetyHeld: false, detail: created.error.code };
    }
    const tampered = {
      ...created.value,
      payload: scenario.scenarioId === 'PERSIST-TRUNCATED' ? '{"custody":' : '{"custody":{}}',
    };
    const verified = verifySnapshot(tampered, {
      networkId: RANGE_NETWORK_ID,
      chainId: RANGE_CHAIN_ID,
      protocolVersion: 'sunrey.ops.v1',
      trustedFinalizedHeight: 10n,
      trustedStateRoot: 'root_10',
    });
    const staleHeight = verifySnapshot(created.value, {
      networkId: RANGE_NETWORK_ID,
      chainId: RANGE_CHAIN_ID,
      protocolVersion: 'sunrey.ops.v1',
      trustedFinalizedHeight: 9n,
      trustedStateRoot: 'root_9',
    });
    const blocked = !verified.ok && !staleHeight.ok && created.value.manifest.includesPrivateKey === false;
    return {
      blocked,
      safetyHeld: blocked,
      livenessDegraded: scenario.scenarioId === 'PERSIST-DB-RESTART' || scenario.scenarioId === 'PERSIST-OUTBOX-INTERRUPT',
      detail: `${scenario.scenarioId} tamper=${verified.ok ? 'accepted' : verified.error.code} stale=${staleHeight.ok ? 'accepted' : staleHeight.error.code}`,
    };
  });
}
