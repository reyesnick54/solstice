/**
 * Wave 8 product integration — service boundary definitions.
 *
 * Responsibilities are grouped by operational practicality, not aesthetic microservices.
 * Canonical monetary truth remains on the sovereign SunRey blockchain.
 */

export const PRODUCT_SERVICE_BOUNDARIES = Object.freeze({
  BLOCKCHAIN_NODE: {
    owner: 'packages/sunrey-chain (node, consensus, storage)',
    responsibility: 'Canonical native asset supply and finalized monetary state',
    mayNot: 'postJournal, issue Execution Authority, store raw PDV',
    persistence: 'Embedded block store (redb); not solstice_* PostgreSQL',
  },
  BLOCKCHAIN_QUERY: {
    owner: 'packages/sunrey-chain (query/indexer projections)',
    responsibility: 'Read-only finalized chain state and transaction proofs',
    mayNot: 'Mutate supply, bypass finality gates',
    persistence: 'Rebuildable projections; chain store authoritative',
  },
  CUSTOMER_IDENTITY: {
    owner: 'packages/identity + services/identity',
    responsibility: 'Login sessions, ActorContext, KYC metadata, resource ownership',
    mayNot: 'Mint, post journals, issue EA',
    persistence: 'solstice_customer (identity, consumer_authentication)',
  },
  LEDGER: {
    owner: 'packages/ledger + services/accounts',
    responsibility: 'Financial/accounting journals; application settlement records',
    mayNot: 'Establish canonical native supply; store balances on Account',
    persistence: 'solstice_ledger (journals, postings — insert-only)',
  },
  EVIDENCE: {
    owner: 'packages/evidence',
    responsibility: 'Hash-chained Kernel decision seals',
    mayNot: 'Override Kernel; mutate after seal',
    persistence: 'solstice_evidence (append-only)',
  },
  SECURITY: {
    owner: 'packages/security',
    responsibility: 'Key metadata, service identity, envelope encryption refs',
    mayNot: 'Issue Execution Authority; store raw private keys in domain config',
    persistence: 'solstice_security (metadata only)',
  },
  ECONOMIC_AWARENESS: {
    owner: 'packages/economic-awareness-fabric + provider-sdk',
    responsibility: 'Observation ingestion, reconciliation, candidate facts',
    mayNot: 'Mint; bypass consent/purpose',
    persistence: 'solstice_customer (provider_runtime); fabric journal partial',
  },
  HUMAN_ECONOMY: {
    owner: 'packages/human-economic-contribution + information-market',
    responsibility: 'Verified human contributions, HIN bridge evidence',
    mayNot: 'Mint SunRey directly; human-worth scoring',
    persistence: 'solstice_customer (information_market, peve); registry partial',
  },
  PRODUCTIVE_ECONOMY: {
    owner: 'packages/sunrey-chain/productive + oracle',
    responsibility: 'Productive objects, oracle facts, GPUV path, MoonRey pipeline',
    mayNot: 'Mint MoonRey directly; conflate capacity with usage',
    persistence: 'solstice_customer (sunrey_chain ops); claim registry partial',
  },
  WALLET: {
    owner: 'packages/custody/product + sunrey-chain/wallet',
    responsibility: 'User-facing projection of chain ownership/account state',
    mayNot: 'Be canonical supply authority; accept client-supplied EA',
    persistence: 'solstice_customer (wallet_and_acceptance, operational_wallet)',
  },
  EXCHANGE: {
    owner: 'packages/sunrey-exchange',
    responsibility: 'Orders, trades, market state, custody/settlement workflow',
    mayNot: 'Mint; treat market price as valuation or issuance quantity',
    persistence: 'solstice_customer (sunrey_exchange, exchange_controls)',
  },
  AGENT: {
    owner: 'packages/sunrey-agent',
    responsibility: 'Mandates, proposals via ProposalGate; bounded automation',
    mayNot: 'Import AuthorityIssuer; convert AgentProposal to ActionIntent without gate',
    persistence: 'solstice_customer (agent_runtime)',
  },
  VAULT: {
    owner: 'packages/personal-data-vault + packages/consent',
    responsibility: 'Subject-bound encrypted store; purpose firewall',
    mayNot: 'Place raw sensitive data on chain; bypass consent',
    persistence: 'solstice_customer (personal_data_vault, consent)',
  },
  CONSUMER_API: {
    owner: 'services/api (consumer BFF)',
    responsibility: 'Orchestration over canonical owners; product read models',
    mayNot: 'Mint; post journals; bypass Kernel',
    persistence: 'Session/idempotency in solstice_customer; no authoritative balances',
  },
  ADMIN_GOVERNANCE: {
    owner: 'packages/kernel/operations + sunrey-chain/governance-ops',
    responsibility: 'Staff operations, ceremony rehearsal, readiness gates',
    mayNot: 'Activate mainnet; post journals; unrestricted mint',
    persistence: 'solstice_customer (operations_control_plane)',
  },
});

export type ProductServiceBoundaryId = keyof typeof PRODUCT_SERVICE_BOUNDARIES;
