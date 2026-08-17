import type { FeatureInventoryEntry } from './types.ts';

export const FEATURE_INVENTORY: readonly FeatureInventoryEntry[] = Object.freeze([
  Object.freeze({
    featureId: 'NATIVE_SUNREY_COIN',
    title: 'Native SunRey coin',
    state: 'FROZEN_IN_RC',
    notes: 'Testnet development units. Ticker NOT_ASSIGNED.',
  }),
  Object.freeze({
    featureId: 'NATIVE_MOONREY_COIN',
    title: 'Native MoonRey coin',
    state: 'FROZEN_IN_RC',
    notes: 'Productive-economy issuance. Ticker NOT_ASSIGNED.',
  }),
  Object.freeze({
    featureId: 'BFT_CONSENSUS',
    title: 'Tendermint-family BFT',
    state: 'FROZEN_IN_RC',
    notes: 'Development/testnet consensus. Not production mainnet.',
  }),
  Object.freeze({
    featureId: 'PROTOCOL_GOVERNANCE',
    title: 'Governed protocol upgrades',
    state: 'FROZEN_IN_RC',
    notes: 'Binary deploy does not auto-activate. Activation height required.',
  }),
  Object.freeze({
    featureId: 'NATIVE_FEES',
    title: 'Native fee and resource metering',
    state: 'FROZEN_IN_RC',
    notes: 'Integer minor units only.',
  }),
  Object.freeze({
    featureId: 'SOVEREIGN_WALLETS',
    title: 'Sovereign wallets',
    state: 'FROZEN_IN_RC',
    notes: 'Classical, hybrid, PQ-capable, M-of-N, watch-only.',
  }),
  Object.freeze({
    featureId: 'ORACLE_NETWORK',
    title: 'Sovereign oracle network',
    state: 'FROZEN_IN_RC',
    notes: 'Simulation adapters. Not a live market-data feed.',
  }),
  Object.freeze({
    featureId: 'PRODUCTIVE_ECONOMY',
    title: 'MoonRey productive economy',
    state: 'FROZEN_IN_RC',
    notes: 'Issuance from verified contribution fingerprints.',
  }),
  Object.freeze({
    featureId: 'MACHINE_COMMERCE',
    title: 'Machine economic identity and commerce',
    state: 'FROZEN_IN_RC',
    notes: 'Mandate-bounded machine spend.',
  }),
  Object.freeze({
    featureId: 'INTEROP_DEV_PACKET',
    title: 'Interop development packet',
    state: 'FROZEN_IN_RC',
    notes: 'Development packet only. Not a live bridge.',
  }),
  Object.freeze({
    featureId: 'EXCHANGE_SETTLEMENT',
    title: 'Exchange native settlement',
    state: 'FROZEN_IN_RC',
    notes: 'Simulation DVP. Tickers NOT_ASSIGNED.',
  }),
  Object.freeze({
    featureId: 'INSTITUTIONAL_CUSTODY',
    title: 'Institutional custody control plane',
    state: 'FROZEN_IN_RC',
    notes: 'Simulation. Canonical quantity remains on chain.',
  }),
  Object.freeze({
    featureId: 'HYBRID_PQC',
    title: 'Hybrid classical + ML-DSA testnet CryptoSuite',
    state: 'FROZEN_IN_RC',
    notes: 'TESTNET_APPROVED only. Not quantum-proof. Not production approval.',
  }),
  Object.freeze({
    featureId: 'PUBLIC_SDK_V1',
    title: 'Public SDK/API v1',
    state: 'FROZEN_IN_RC',
    notes: 'Breaking API changes require a new RC.',
  }),
  Object.freeze({
    featureId: 'EXPLORER_PROJECTION',
    title: 'Rebuildable explorer projection',
    state: 'FROZEN_IN_RC',
    notes: 'Projection only. Banner remains SUNREY TESTNET.',
  }),
  Object.freeze({
    featureId: 'DEVELOPMENT_FAUCET',
    title: 'Testnet faucet',
    state: 'FROZEN_IN_RC',
    notes: 'Development units. No monetary value.',
  }),
  Object.freeze({
    featureId: 'PUBLIC_STAKING',
    title: 'Public staking',
    state: 'EXCLUDED_FROM_RC',
    notes: 'Not activated on Testnet 1.',
  }),
  Object.freeze({
    featureId: 'PRODUCTION_BANKING_RAILS',
    title: 'Production banking rails',
    state: 'EXCLUDED_FROM_RC',
    notes: 'LIVE_* flags stay false. ENVIRONMENT stays simulation.',
  }),
  Object.freeze({
    featureId: 'MAINNET',
    title: 'Mainnet / production financial services',
    state: 'EXCLUDED_FROM_RC',
    notes: 'This RC cannot activate mainnet.',
  }),
  Object.freeze({
    featureId: 'FORMAL_MACHINE_CHECKED_PROOFS',
    title: 'Chunk 61 machine-checked formal proofs',
    state: 'EXPERIMENTAL_TESTNET_ONLY',
    notes: 'Chunk 61 is not merged. RC attaches property/invariant smoke only.',
  }),
  Object.freeze({
    featureId: 'ENDURANCE_MULTI_DAY',
    title: 'Multi-day endurance qualification',
    state: 'EXPERIMENTAL_TESTNET_ONLY',
    notes: 'Configurable workflow. Do not claim a multi-day run unless it completed.',
  }),
]);

export function featureStateOrThrow(featureId: string): FeatureInventoryEntry {
  const found = FEATURE_INVENTORY.find((row) => row.featureId === featureId);
  if (!found) {
    throw new TypeError(`unknown feature ${featureId}`);
  }
  return found;
}

export function assertNoAmbiguousFeatureState(): true {
  for (const row of FEATURE_INVENTORY) {
    if (row.state !== 'FROZEN_IN_RC' && row.state !== 'EXCLUDED_FROM_RC' && row.state !== 'EXPERIMENTAL_TESTNET_ONLY') {
      throw new TypeError(`ambiguous feature state for ${row.featureId}`);
    }
  }
  return true;
}
