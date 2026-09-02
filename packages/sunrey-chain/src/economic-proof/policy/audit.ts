/**
 * Wave 3 Task 1 — audit of current economic policy locations and storage classes.
 *
 * Read-only inventory. Does not modify PEVE/GPUV formulas or activate production.
 */

export const POLICY_STORAGE_CLASS = [
  'HARD_CODED',
  'CONFIGURATION',
  'DATABASE_RECORD',
  'DOCUMENT',
  'RUNTIME_PARAMETER',
  'SIMULATION_FIXTURE',
] as const;
export type PolicyStorageClass = (typeof POLICY_STORAGE_CLASS)[number];

export type PolicyAuditEntry = {
  readonly name: string;
  readonly policyType: string;
  readonly storageClass: PolicyStorageClass;
  readonly location: string;
  readonly versioned: boolean;
  readonly versionIdentifier: string | null;
  readonly governanceBound: boolean;
  readonly notes: string;
};

/**
 * Canonical inventory of economic policy surfaces discovered in Wave 3 audit.
 * Recoverable policy versions for finalized monetary history must be registered
 * in the PolicyRegistry — this audit does not migrate them automatically.
 */
export const POLICY_AUDIT_INVENTORY: readonly PolicyAuditEntry[] = Object.freeze([
  {
    name: 'PEVE formula weights',
    policyType: 'VALUATION_METHODOLOGY',
    storageClass: 'HARD_CODED',
    location: 'packages/platform/src/value/formula.ts',
    versioned: true,
    versionIdentifier: 'peve-formula-v1 / peve-formula-v2',
    governanceBound: false,
    notes: 'Intelligence only; not monetary authority. Wave 3 binds via methodology ref.',
  },
  {
    name: 'GPUV value function policy',
    policyType: 'VALUATION_METHODOLOGY',
    storageClass: 'SIMULATION_FIXTURE',
    location: 'packages/sunrey-chain/src/productive/policy-governance/value-function/policy.ts',
    versioned: true,
    versionIdentifier: 'policyVersion',
    governanceBound: true,
    notes: 'Chunk 124 simulation; cannot mint.',
  },
  {
    name: 'MoonRey issuance policy bundle',
    policyType: 'MONETARY_ISSUANCE_POLICY',
    storageClass: 'SIMULATION_FIXTURE',
    location: 'packages/sunrey-chain/src/productive/policy-governance/registry.ts',
    versioned: true,
    versionIdentifier: 'policyVersion + contentHash',
    governanceBound: true,
    notes: 'Chunk 74; AI cannot activate.',
  },
  {
    name: 'Human contribution valuation policy',
    policyType: 'HUMAN_CONTRIBUTION_POLICY',
    storageClass: 'SIMULATION_FIXTURE',
    location: 'packages/human-economic-contribution/src/valuation/policy.ts',
    versioned: true,
    versionIdentifier: 'policyId + version',
    governanceBound: true,
    notes: 'Explicitly not PEVE; simulation parameters only.',
  },
  {
    name: 'Human contribution verification policy',
    policyType: 'VERIFICATION_POLICY',
    storageClass: 'HARD_CODED',
    location: 'packages/human-economic-contribution/src/verification/policy.ts',
    versioned: false,
    versionIdentifier: null,
    governanceBound: false,
    notes: 'Eligibility rules; Wave 3 registers as versioned definition.',
  },
  {
    name: 'Chunk 71 monetary constitution',
    policyType: 'MONETARY_ISSUANCE_POLICY',
    storageClass: 'DOCUMENT',
    location: 'docs/economics/chunk-71-monetary-constitution.md',
    versioned: true,
    versionIdentifier: 'constitution version',
    governanceBound: true,
    notes: 'Canonical mint gate; production activation firewall.',
  },
  {
    name: 'Production economic activation firewall',
    policyType: 'GOVERNANCE_POLICY',
    storageClass: 'HARD_CODED',
    location: 'packages/sunrey-chain/src/economics/production-activation/firewall.ts',
    versioned: true,
    versionIdentifier: 'evaluator version',
    governanceBound: true,
    notes: 'Chunk 143; does not activate production.',
  },
  {
    name: 'Production economic parameter authorization',
    policyType: 'GOVERNANCE_POLICY',
    storageClass: 'RUNTIME_PARAMETER',
    location: 'packages/sunrey-chain/src/economics/production-activation/authorization/',
    versioned: true,
    versionIdentifier: 'authorization package hash',
    governanceBound: true,
    notes: 'Chunk 163; human approvals required.',
  },
  {
    name: 'Protocol governance policy',
    policyType: 'GOVERNANCE_POLICY',
    storageClass: 'RUNTIME_PARAMETER',
    location: 'packages/sunrey-chain/src/governance/types.ts',
    versioned: true,
    versionIdentifier: 'governancePolicyVersion',
    governanceBound: true,
    notes: 'Chunk 40 upgrade plans and votes.',
  },
  {
    name: 'MoonRey attribution policy',
    policyType: 'PRODUCTIVE_CONTRIBUTION_POLICY',
    storageClass: 'SIMULATION_FIXTURE',
    location: 'packages/sunrey-chain/src/productive/policy-governance/attribution/policy.ts',
    versioned: true,
    versionIdentifier: 'policyId + version',
    governanceBound: true,
    notes: 'Chunk 121; governed cross-domain attribution.',
  },
  {
    name: 'Network economic parameters',
    policyType: 'NETWORK_ECONOMIC_POLICY',
    storageClass: 'CONFIGURATION',
    location: 'packages/sunrey-chain/src/governance/types.ts (ConsensusParams)',
    versioned: true,
    versionIdentifier: 'consensusParamsHash',
    governanceBound: true,
    notes: 'Height-activated via UpgradePlan.',
  },
  {
    name: 'Customer policy engine rules',
    policyType: 'GOVERNANCE_POLICY',
    storageClass: 'DATABASE_RECORD',
    location: 'db/customer/migrations/V003__policy_engine.sql',
    versioned: true,
    versionIdentifier: 'rule version column',
    governanceBound: false,
    notes: 'Kernel jurisdiction policy; distinct from economic proof policy root.',
  },
  {
    name: 'Economic eligibility thresholds',
    policyType: 'VERIFICATION_POLICY',
    storageClass: 'HARD_CODED',
    location: 'packages/sunrey-chain/src/productive/policy-governance/eligibility.ts',
    versioned: true,
    versionIdentifier: 'policyVersion',
    governanceBound: true,
    notes: 'Contribution eligibility gates.',
  },
]);

export function auditEntriesByType(policyType: string): readonly PolicyAuditEntry[] {
  return POLICY_AUDIT_INVENTORY.filter((entry) => entry.policyType === policyType);
}

export function auditEntriesByStorage(storageClass: PolicyStorageClass): readonly PolicyAuditEntry[] {
  return POLICY_AUDIT_INVENTORY.filter((entry) => entry.storageClass === storageClass);
}
