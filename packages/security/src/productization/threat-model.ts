/**
 * System-wide threat model. Engineering catalog, not an external audit.
 */

export const THREAT_IDS = [
  'FINANCIAL_FRAUD',
  'ACCOUNT_TAKEOVER',
  'PROVIDER_COMPROMISE',
  'INSIDER_THREAT',
  'AGENT_ABUSE',
  'EXCHANGE_MANIPULATION',
  'WALLET_THEFT',
  'VALIDATOR_COMPROMISE',
  'ORACLE_MANIPULATION',
  'PERSONAL_DATA_DISCLOSURE',
  'SUPPLY_CHAIN_COMPROMISE',
  'DDOS',
] as const;

export type ThreatId = (typeof THREAT_IDS)[number];

export type ThreatRecord = {
  readonly id: ThreatId;
  readonly actor: string;
  readonly asset: string;
  readonly mitigations: readonly string[];
  readonly residual: string;
  readonly externalAuditComplete: false;
};

export const SYSTEM_THREAT_MODEL: readonly ThreatRecord[] = Object.freeze([
  {
    id: 'FINANCIAL_FRAUD',
    actor: 'external or compromised customer',
    asset: 'ledger journals / payment orders',
    mitigations: ['Kernel six proofs', 'Execution Authority', 'idempotency', 'corridor filter'],
    residual: 'counsel-confirmed corridors and live rails remain absent',
    externalAuditComplete: false,
  },
  {
    id: 'ACCOUNT_TAKEOVER',
    actor: 'credential / session thief',
    asset: 'IdentitySession / refresh family',
    mitigations: ['short-lived access tokens', 'refresh reuse detection', 'step-up', 'no userId from body'],
    residual: 'stolen access token is valid until expiry or revoke',
    externalAuditComplete: false,
  },
  {
    id: 'PROVIDER_COMPROMISE',
    actor: 'bank / KYC / custody / oracle vendor',
    asset: 'provider callbacks and credentials',
    mitigations: ['SecretReference', 'environment isolation', 'webhook signature/replay', 'domain state machines'],
    residual: 'fixture adapters only; live vendors not connected',
    externalAuditComplete: false,
  },
  {
    id: 'INSIDER_THREAT',
    actor: 'operator or developer',
    asset: 'admin surfaces, keys, databases',
    mitigations: ['named accounts', 'step-up', 'break-glass records', 'no shared admin', 'superuser forbidden'],
    residual: 'break-glass still grants high privilege for a short window',
    externalAuditComplete: false,
  },
  {
    id: 'AGENT_ABUSE',
    actor: 'prompt injection or malicious tool',
    asset: 'proposals / user data',
    mitigations: ['ProposalGate', 'no EA', 'no secrets in context', 'cross-user deny', 'no privileged tools'],
    residual: 'ALLOW means fit for a human to consider',
    externalAuditComplete: false,
  },
  {
    id: 'EXCHANGE_MANIPULATION',
    actor: 'trader or compromised API key',
    asset: 'order book / settlement',
    mitigations: ['identity/eligibility', 'surveillance alerts', 'ledger-backed settlement ports'],
    residual: 'commercial liquidity and live matching are not authorized',
    externalAuditComplete: false,
  },
  {
    id: 'WALLET_THEFT',
    actor: 'key extractor or RPC attacker',
    asset: 'WALLET_SIGNING / custody handles',
    mitigations: ['non-exportable HSM contract', 'purpose separation', 'RPC cannot reach HSM'],
    residual: 'production HSM is not connected',
    externalAuditComplete: false,
  },
  {
    id: 'VALIDATOR_COMPROMISE',
    actor: 'validator operator or network adversary',
    asset: 'consensus keys / genesis',
    mitigations: ['ceremony', 'key purpose matrix', 'mainnet off', 'signer zone isolation'],
    residual: 'simulation HSM is not a launch key',
    externalAuditComplete: false,
  },
  {
    id: 'ORACLE_MANIPULATION',
    actor: 'data provider or collector',
    asset: 'productive / market facts',
    mitigations: ['source taxonomy', 'environment isolation', 'facts do not mint', 'fail-closed transport'],
    residual: 'licensed live data rights are absent',
    externalAuditComplete: false,
  },
  {
    id: 'PERSONAL_DATA_DISCLOSURE',
    actor: 'external reader or insider',
    asset: 'PDV / identity / KYC metadata',
    mitigations: ['envelope encryption', 'subject binding', 'redaction', 'TLS at rest transport'],
    residual: 'field inventory is engineering, not a privacy audit opinion',
    externalAuditComplete: false,
  },
  {
    id: 'SUPPLY_CHAIN_COMPROMISE',
    actor: 'dependency or CI attacker',
    asset: 'build artifacts / Actions',
    mitigations: ['lockfiles', 'pinned Actions', 'SBOM', 'secret scan', 'release signing purpose'],
    residual: 'container digests are required for release but not all populated',
    externalAuditComplete: false,
  },
  {
    id: 'DDOS',
    actor: 'unauthenticated flood',
    asset: 'PUBLIC_API / PUBLIC_RPC availability',
    mitigations: ['rate limits', 'endpoint classes', 'default-deny internal paths'],
    residual: 'edge WAF / Anycast is an external deploy control',
    externalAuditComplete: false,
  },
]);
