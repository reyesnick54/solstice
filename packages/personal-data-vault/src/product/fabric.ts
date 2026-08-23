/**
 * Canonical Personal Data Fabric identity.
 *
 * The fabric is the Personal Data Vault. This file names that fact so
 * productization does not create packages/personal-data-fabric or a
 * second subject store. Economic-oracle fabrics in sunrey-chain are
 * unrelated productive-economy feeds.
 */

export const CANONICAL_PERSONAL_DATA_FABRIC = Object.freeze({
  id: 'sunrey.personal-data-fabric.v1',
  owner: 'packages/personal-data-vault',
  authoritativePath: 'packages/personal-data-vault/src/service.ts',
  productFacade: 'packages/personal-data-vault/src/product/service.ts',
  secondFabricForbidden: true,
  isNotPeg: true,
  isNotEvidenceVault: true,
  isNotHin: true,
  isNotConsentLedger: true,
  productionActive: false,
  liveMonetizationEnabled: false,
});

export type PersonalDataFabricAuditRow = {
  readonly path: string;
  readonly classification:
    | 'CANONICAL'
    | 'SPECIALIZED'
    | 'SIMULATION_ONLY'
    | 'IN_MEMORY'
    | 'DUPLICATED'
    | 'DEPRECATED'
    | 'INCOMPLETE';
  readonly notes: string;
};

export const PHASE_H_DATA_ARCHITECTURE_AUDIT: readonly PersonalDataFabricAuditRow[] = Object.freeze([
  {
    path: 'packages/personal-data-vault',
    classification: 'CANONICAL',
    notes: 'Subject-bound encrypted Personal Data Vault and productized Data Fabric.',
  },
  {
    path: 'packages/consent',
    classification: 'CANONICAL',
    notes: 'Consent Ledger / Purpose Firewall. Not a second vault.',
  },
  {
    path: 'packages/information-market',
    classification: 'CANONICAL',
    notes: 'HIN information rights. References vault metadata only.',
  },
  {
    path: 'packages/human-economic-contribution',
    classification: 'CANONICAL',
    notes: 'Verified contribution registry. Not a personal data store.',
  },
  {
    path: 'packages/identity',
    classification: 'CANONICAL',
    notes: 'Identity / KYC metadata. Vault stores references, not KYC documents.',
  },
  {
    path: 'packages/evidence',
    classification: 'CANONICAL',
    notes: 'Hash-chained Evidence Vault. Distinct from Personal Data Vault.',
  },
  {
    path: 'packages/events',
    classification: 'CANONICAL',
    notes: 'Versioned domain events. Vault events carry no sensitive payloads.',
  },
  {
    path: 'packages/persistence',
    classification: 'SPECIALIZED',
    notes: 'PostgreSQL adapter for vault metadata and encrypted envelopes.',
  },
  {
    path: 'packages/personal-data-vault/src/store.ts',
    classification: 'IN_MEMORY',
    notes: 'Runtime store. Persisted through packages/persistence.',
  },
  {
    path: 'packages/sunrey-agent',
    classification: 'SPECIALIZED',
    notes: 'Agent reads vault through constrained tools. No default full-vault dump.',
  },
  {
    path: 'packages/personal-economic-graph',
    classification: 'CANONICAL',
    notes: 'PEG may reference vault facts. Vault is not a second financial graph.',
  },
  {
    path: 'packages/sunrey-coin',
    classification: 'SPECIALIZED',
    notes: 'Application coin journals. Not a data fabric.',
  },
  {
    path: 'packages/sunrey-chain/src/economics/supply.ts',
    classification: 'CANONICAL',
    notes: 'MoonRey / SunRey native supply. Not personal data.',
  },
  {
    path: 'packages/sunrey-chain/src/oracle',
    classification: 'SPECIALIZED',
    notes: 'Oracle / productive-economy provenance. Not the Personal Data Fabric.',
  },
  {
    path: 'packages/clean-room',
    classification: 'SPECIALIZED',
    notes: 'Authorized aggregate computation. Consumes vault via consent, not a store.',
  },
]);
