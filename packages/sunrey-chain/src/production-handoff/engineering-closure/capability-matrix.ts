import type { CoreCapabilityMatrixRow } from './types.ts';

export const CORE_ENGINEERING_CAPABILITY_MATRIX: readonly CoreCapabilityMatrixRow[] = Object.freeze([
  row('CONSUMER_FINTECH', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/domain + services/accounts + packages/cards', 'Accounts, cards, and consumer surfaces exist in simulation.'),
  row('BANKING_PAYMENTS', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/payments', 'Payments, FX, and rail adapters are fixture-only. Live bank/rail/FX are external dependencies, not missing software.'),
  row('WEALTH_GROWTH', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/platform + packages/investments + packages/treasury', 'Grow My Money / PEVE / investments are simulation. PEVE is not human worth and not token valuation.'),
  row('AI', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/ai-runtime + packages/sunrey-agent + packages/agent', 'Inference and ProposalGate only. AI cannot execute, mint, or issue Execution Authority.'),
  row('COMPLIANCE', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/kernel', 'Six proofs, screening fabric, and operating-scope matrix. Counsel opinions and licenses are external.'),
  row('DATA_PRIVACY', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/personal-data-vault + packages/consent + packages/clean-room + packages/information-market', 'PDV / consent / HIN implemented. Raw human data does not go on-chain.'),
  row('SUNREY_CHAIN', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/sunrey-chain', 'Consensus, validators, governance, wallets, fees, interop, public data plane. No Ethereum base layer.'),
  row('SUNREY_COIN', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/sunrey-chain + packages/sunrey-coin', 'Native SUNREY_COIN path implemented. Ticker and max supply are human decisions.'),
  row('MOONREY_COIN', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/sunrey-chain', 'Native MOONREY_COIN path implemented via sunrey-native-assets + moonrey-issuance-engine. moonrey-coin placeholder is SUPERSEDED. Ticker and max supply are human decisions.'),
  row('DUAL_ECONOMY', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/sunrey-chain + packages/sunrey-economics', 'Chunk 71 is the monetary gate. AssetSupplyBook is supply authority. Production parameters remain unconfigured.'),
  row('ORACLES', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/sunrey-chain', 'Oracle consensus and productive fabrics exist. Reference price cannot mint. Production valuation remains inactive.'),
  row('EXCHANGE', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/sunrey-exchange', 'Matching, DVP, consumer and institutional APIs. No live exchange.'),
  row('CUSTODY', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/custody', 'Dual-native-asset isolation and provider-candidate framework. Real HSM/custody providers are external.'),
  row('SECURITY', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/security', 'CryptoSuite, credentials, PQC testnet. Production HSM/KMS evidence is external.'),
  row('PERSISTENCE', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/persistence + packages/events', 'PostgreSQL adapters, recovery, idempotency. Not a second ledger.'),
  row('OPERATIONS', 'IMPLEMENTED_SIMULATION_ONLY', 'packages/sunrey-chain', 'Ops, control room, launch rehearsal, handoff. Staffing and on-call acceptance are human/external.'),
  row('PRODUCTION_CONTROL', 'HUMAN_DECISION_REQUIRED', 'packages/sunrey-chain', 'Activation firewall, parameter registry, and authorization assembly are implemented. Production remains inactive until human/external inputs exist.'),
]);

function row(
  group: CoreCapabilityMatrixRow['group'],
  status: CoreCapabilityMatrixRow['status'],
  owner: string,
  notes: string,
): CoreCapabilityMatrixRow {
  return Object.freeze({ group, status, owner, notes });
}

export function actualEngineeringGaps(
  matrix: readonly CoreCapabilityMatrixRow[] = CORE_ENGINEERING_CAPABILITY_MATRIX,
): readonly string[] {
  return Object.freeze(matrix.filter((row) => row.status === 'ACTUAL_ENGINEERING_GAP').map((row) => row.group));
}
