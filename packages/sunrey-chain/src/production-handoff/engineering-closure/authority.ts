import type { AuthorityBinding } from './types.ts';

/**
 * Canonical authority map. One owner per protected authority.
 * These paths already exist; Chunk 168 does not create a second owner.
 */
export const CANONICAL_AUTHORITY_GRAPH: readonly AuthorityBinding[] = Object.freeze([
  Object.freeze({ authority: 'Money', owner: 'packages/money', path: 'packages/money/src/money.ts', unique: true }),
  Object.freeze({ authority: 'Identity', owner: 'packages/identity', path: 'packages/identity/src/service.ts', unique: true }),
  Object.freeze({ authority: 'Kernel', owner: 'packages/kernel', path: 'packages/kernel/src/kernel.ts', unique: true }),
  Object.freeze({
    authority: 'Execution Authority',
    owner: 'packages/permissions',
    path: 'packages/permissions/src/execution-authority.ts',
    unique: true,
  }),
  Object.freeze({ authority: 'Ledger', owner: 'packages/ledger', path: 'packages/ledger/src/journal.ts', unique: true }),
  Object.freeze({ authority: 'Evidence Vault', owner: 'packages/evidence', path: 'packages/evidence/src/vault.ts', unique: true }),
  Object.freeze({ authority: 'Events', owner: 'packages/events', path: 'packages/events/src/events.ts', unique: true }),
  Object.freeze({
    authority: 'Persistence',
    owner: 'packages/persistence',
    path: 'packages/persistence/src/index.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'SunRey Chain consensus',
    owner: 'packages/sunrey-chain',
    path: 'packages/sunrey-chain/rust/crates/consensus',
    unique: true,
  }),
  Object.freeze({
    authority: 'native asset supply',
    owner: 'packages/sunrey-chain',
    path: 'packages/sunrey-chain/src/economics/supply.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Chunk 71 monetary issuance',
    owner: 'packages/sunrey-chain',
    path: 'packages/sunrey-chain/src/economics/constitution.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'AssetSupplyBook',
    owner: 'packages/sunrey-chain',
    path: 'packages/sunrey-chain/src/economics/supply.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'HIN rights',
    owner: 'packages/information-market',
    path: 'packages/information-market/src/network/engine.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Human Contribution Registry',
    owner: 'packages/human-economic-contribution',
    path: 'packages/human-economic-contribution/src/registry.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Human Contribution Valuation',
    owner: 'packages/human-economic-contribution',
    path: 'packages/human-economic-contribution/src/valuation/engine.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Oracle consensus',
    owner: 'packages/sunrey-chain',
    path: 'packages/sunrey-chain/src/oracle/engine.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Productive Event Identity',
    owner: 'packages/sunrey-chain',
    path: 'packages/sunrey-chain/src/productive/policy-governance/attribution/store.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Attribution',
    owner: 'packages/sunrey-chain',
    path: 'packages/sunrey-chain/src/productive/policy-governance/attribution/engine.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Productive Value / GPUV',
    owner: 'packages/sunrey-chain',
    path: 'packages/sunrey-chain/src/productive/policy-governance/value-function/engine.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Exchange',
    owner: 'packages/sunrey-exchange',
    path: 'packages/sunrey-exchange/src/index.ts',
    unique: true,
  }),
  Object.freeze({ authority: 'Custody', owner: 'packages/custody', path: 'packages/custody/src/index.ts', unique: true }),
  Object.freeze({
    authority: 'Payments',
    owner: 'packages/payments',
    path: 'packages/payments/src/service.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'Compliance',
    owner: 'packages/kernel',
    path: 'packages/kernel/src/compliance/fabric.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'AI runtime',
    owner: 'packages/ai-runtime',
    path: 'packages/ai-runtime/src/runtime.ts',
    unique: true,
  }),
  Object.freeze({
    authority: 'SunRey Agent',
    owner: 'packages/sunrey-agent',
    path: 'packages/sunrey-agent/src/engine.ts',
    unique: true,
  }),
]);

export function authorityDuplicates(graph: readonly AuthorityBinding[] = CANONICAL_AUTHORITY_GRAPH): number {
  const seen = new Map<string, string>();
  let duplicates = 0;
  for (const row of graph) {
    const previous = seen.get(row.authority);
    if (previous && previous !== row.owner) {
      duplicates += 1;
    }
    seen.set(row.authority, row.owner);
  }
  return duplicates;
}
