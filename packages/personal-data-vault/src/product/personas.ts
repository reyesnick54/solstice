/**
 * Deterministic sandbox Vault personas. No real personal data.
 */

export const VAULT_PERSONAS_ARE_SIMULATION_ONLY = true as const;

export const VAULT_PERSONA_IDS = [
  'MINIMAL',
  'FINANCIAL',
  'EMPLOYMENT_SKILLS',
  'MULTI_SOURCE',
  'DERIVED',
  'DISPUTED',
  'REVOKED',
  'RESTRICTED_AGENT',
] as const;
export type VaultPersonaId = (typeof VAULT_PERSONA_IDS)[number];

export type VaultPersonaSeedRecord = {
  readonly key: string;
  readonly categoryId: string;
  readonly schemaId: string;
  readonly schemaVersion: string;
  readonly sourceId: string;
  readonly provenanceKind: 'USER_DECLARED' | 'USER_UPLOADED' | 'EXTERNAL_CONNECTOR' | 'DERIVED';
  readonly payload: Record<string, unknown>;
  readonly dispute?: boolean;
  readonly revoke?: boolean;
  readonly deriveFrom?: string;
};

export type VaultPersonaSeed = {
  readonly personaId: VaultPersonaId;
  readonly label: string;
  readonly simulationOnly: true;
  readonly subjectSuffix: string;
  readonly agentCategories: readonly string[];
  readonly records: readonly VaultPersonaSeedRecord[];
};

export const VAULT_PERSONA_SEEDS: readonly VaultPersonaSeed[] = Object.freeze([
  Object.freeze({
    personaId: 'MINIMAL',
    label: 'Minimal vault',
    simulationOnly: true,
    subjectSuffix: 'vault_minimal',
    agentCategories: Object.freeze(['goals_preferences']),
    records: Object.freeze([
      {
        key: 'pref',
        categoryId: 'goals_preferences',
        schemaId: 'pdsch_preference',
        schemaVersion: '1',
        sourceId: 'pds_user_declared',
        provenanceKind: 'USER_DECLARED' as const,
        payload: { key: 'preferred_currency', value: 'USD' },
      },
    ]),
  }),
  Object.freeze({
    personaId: 'FINANCIAL',
    label: 'Financial-data vault',
    simulationOnly: true,
    subjectSuffix: 'vault_financial',
    agentCategories: Object.freeze(['financial']),
    records: Object.freeze([
      {
        key: 'payroll',
        categoryId: 'financial',
        schemaId: 'pdsch_payroll',
        schemaVersion: '1',
        sourceId: 'pds_sim_payroll',
        provenanceKind: 'EXTERNAL_CONNECTOR' as const,
        payload: {
          employer: 'Sandbox Employer Co',
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          grossMinor: '450000',
          netMinor: '320000',
          currency: 'USD',
          payDate: '2026-07-31',
        },
      },
    ]),
  }),
  Object.freeze({
    personaId: 'EMPLOYMENT_SKILLS',
    label: 'Employment and skills',
    simulationOnly: true,
    subjectSuffix: 'vault_employment',
    agentCategories: Object.freeze(['employment', 'skills']),
    records: Object.freeze([
      {
        key: 'job',
        categoryId: 'employment',
        schemaId: 'pdsch_employment',
        schemaVersion: '1',
        sourceId: 'pds_user_declared',
        provenanceKind: 'USER_DECLARED' as const,
        payload: { employer: 'Northwind Labs', title: 'Analyst', startedOn: '2024-03-01' },
      },
      {
        key: 'skill',
        categoryId: 'skills',
        schemaId: 'pdsch_skills',
        schemaVersion: '1',
        sourceId: 'pds_user_declared',
        provenanceKind: 'USER_DECLARED' as const,
        payload: { skill: 'financial-analysis', level: 'intermediate' },
      },
    ]),
  }),
  Object.freeze({
    personaId: 'MULTI_SOURCE',
    label: 'Multiple sources',
    simulationOnly: true,
    subjectSuffix: 'vault_multi_source',
    agentCategories: Object.freeze(['financial', 'consumption', 'goals_preferences']),
    records: Object.freeze([
      {
        key: 'payroll',
        categoryId: 'financial',
        schemaId: 'pdsch_payroll',
        schemaVersion: '1',
        sourceId: 'pds_sim_payroll',
        provenanceKind: 'EXTERNAL_CONNECTOR' as const,
        payload: {
          employer: 'Multi Source Co',
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          grossMinor: '410000',
          netMinor: '300000',
          currency: 'USD',
          payDate: '2026-07-31',
        },
      },
      {
        key: 'receipt',
        categoryId: 'consumption',
        schemaId: 'pdsch_receipt',
        schemaVersion: '1',
        sourceId: 'pds_user_upload',
        provenanceKind: 'USER_UPLOADED' as const,
        payload: {
          merchant: 'Sandbox Market',
          purchasedAt: '2026-08-09T16:40:00.000Z',
          totalMinor: '1899',
          currency: 'USD',
        },
      },
      {
        key: 'pref',
        categoryId: 'goals_preferences',
        schemaId: 'pdsch_preference',
        schemaVersion: '1',
        sourceId: 'pds_user_declared',
        provenanceKind: 'USER_DECLARED' as const,
        payload: { key: 'savings_goal', value: 'emergency' },
      },
    ]),
  }),
  Object.freeze({
    personaId: 'DERIVED',
    label: 'Derived insights',
    simulationOnly: true,
    subjectSuffix: 'vault_derived',
    agentCategories: Object.freeze(['consumption']),
    records: Object.freeze([
      {
        key: 'tx',
        categoryId: 'financial',
        schemaId: 'pdsch_transactions',
        schemaVersion: '1',
        sourceId: 'pds_sim_transactions',
        provenanceKind: 'EXTERNAL_CONNECTOR' as const,
        payload: {
          transactions: [
            {
              id: 'txn_d1',
              bookedAt: '2026-06-03T18:00:00.000Z',
              merchant: 'Cafe Sandbox',
              category: 'dining',
              amountMinor: '2400',
              currency: 'USD',
            },
          ],
        },
      },
      {
        key: 'summary',
        categoryId: 'consumption',
        schemaId: 'pdsch_spending_summary',
        schemaVersion: '1',
        sourceId: 'pds_derived_spending',
        provenanceKind: 'DERIVED' as const,
        deriveFrom: 'tx',
        payload: {
          windowFrom: '2026-06-01T00:00:00.000Z',
          windowTo: '2026-08-01T00:00:00.000Z',
          currency: 'USD',
          categories: [{ category: 'dining', totalMinor: '2400' }],
        },
      },
    ]),
  }),
  Object.freeze({
    personaId: 'DISPUTED',
    label: 'Disputed derived data',
    simulationOnly: true,
    subjectSuffix: 'vault_disputed',
    agentCategories: Object.freeze(['consumption']),
    records: Object.freeze([
      {
        key: 'summary',
        categoryId: 'consumption',
        schemaId: 'pdsch_spending_summary',
        schemaVersion: '1',
        sourceId: 'pds_derived_spending',
        provenanceKind: 'DERIVED' as const,
        dispute: true,
        payload: {
          windowFrom: '2026-06-01T00:00:00.000Z',
          windowTo: '2026-08-01T00:00:00.000Z',
          currency: 'USD',
          categories: [{ category: 'dining', totalMinor: '9999' }],
        },
      },
    ]),
  }),
  Object.freeze({
    personaId: 'REVOKED',
    label: 'Revoked record',
    simulationOnly: true,
    subjectSuffix: 'vault_revoked',
    agentCategories: Object.freeze([]),
    records: Object.freeze([
      {
        key: 'old_pref',
        categoryId: 'goals_preferences',
        schemaId: 'pdsch_preference',
        schemaVersion: '1',
        sourceId: 'pds_user_declared',
        provenanceKind: 'USER_DECLARED' as const,
        revoke: true,
        payload: { key: 'newsletter', value: 'opt_in' },
      },
    ]),
  }),
  Object.freeze({
    personaId: 'RESTRICTED_AGENT',
    label: 'Restricted Agent access',
    simulationOnly: true,
    subjectSuffix: 'vault_restricted_agent',
    agentCategories: Object.freeze([]),
    records: Object.freeze([
      {
        key: 'pref',
        categoryId: 'goals_preferences',
        schemaId: 'pdsch_preference',
        schemaVersion: '1',
        sourceId: 'pds_user_declared',
        provenanceKind: 'USER_DECLARED' as const,
        payload: { key: 'agent_access', value: 'denied' },
      },
    ]),
  }),
] as readonly VaultPersonaSeed[]);

export function vaultPersonaSeed(id: VaultPersonaId): VaultPersonaSeed {
  const found = VAULT_PERSONA_SEEDS.find((row) => row.personaId === id);
  if (!found) {
    throw new Error(`unknown vault persona ${id}`);
  }
  return found;
}
