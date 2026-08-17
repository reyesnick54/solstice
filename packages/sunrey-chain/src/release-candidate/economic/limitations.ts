import { BUILTIN_KNOWN_LIMITATIONS, loadKnownSecurityLimitations } from '../limitations.ts';
import type { EconomicKnownLimitation } from './types.ts';

export const ECONOMIC_KNOWN_LIMITATIONS: readonly EconomicKnownLimitation[] = Object.freeze([
  Object.freeze({
    id: 'NOT_MAINNET',
    title: 'This economic candidate is TESTNET / PRODUCTION-CANDIDATE qualification only. It does not authorize mainnet.',
    severity: 'critical',
    source: 'chunk-78',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'ENGINEERING_NOT_REGULATORY',
    title: 'Qualification states are engineering results. They do not imply regulatory, legal, or counsel approval.',
    severity: 'critical',
    source: 'chunk-78',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'PRODUCTION_PARAMETERS_UNCONFIGURED',
    title: 'Production economic parameters remain UNCONFIGURED. Values are not invented to complete the matrix.',
    severity: 'critical',
    source: 'chunk-71',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'TICKERS_NOT_ASSIGNED',
    title: 'Public tickers remain NOT_ASSIGNED. Test units have no implied monetary value.',
    severity: 'critical',
    source: 'chunk-53',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'SIMULATION_ENVIRONMENT',
    title: 'ENVIRONMENT stays simulation. Every LIVE_* flag stays false.',
    severity: 'critical',
    source: 'packages/config',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'EXTERNAL_ORACLE_AGREEMENTS_ABSENT',
    title: 'External oracle provider agreements are absent. Missing agreements are never confirmed.',
    severity: 'warning',
    source: 'chunk-68',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'PRODUCTION_HSM_EVIDENCE_ABSENT',
    title: 'Production HSM evidence is absent. Local/test ReleaseAuthority signing only.',
    severity: 'warning',
    source: 'chunk-64',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'EXTERNAL_AUDIT_ABSENT',
    title: 'Independent external audit evidence is absent. Chunk 62 is engineering preparation only.',
    severity: 'warning',
    source: 'chunk-62',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'LEGAL_REGULATORY_INCOMPLETE',
    title: 'Legal and regulatory evidence remains incomplete. Repository positions stay RESEARCH_REQUIRED.',
    severity: 'critical',
    source: 'chunk-65',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'PROTOCOL_TREASURY_PRODUCTION_UNCONFIGURED',
    title: 'Protocol treasury production budget and disbursement parameters remain UNCONFIGURED. Fee disposition is the frozen engineering sink.',
    severity: 'warning',
    source: 'chunk-73',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'RELEASE_AUTHORITY_NOT_POLICY_ACTIVATION',
    title: 'ReleaseAuthority signs the economic bundle only. Signing does not activate economic policy.',
    severity: 'critical',
    source: 'chunk-59',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'EXTENDED_DURATION_NOT_CLAIMED',
    title: 'Do not claim a long-horizon or soak duration unless that duration actually completed.',
    severity: 'warning',
    source: 'chunk-78',
    hiddenFromReleaseNotes: false,
  }),
]);

export function loadEconomicKnownLimitations(root: string): readonly EconomicKnownLimitation[] {
  const security = loadKnownSecurityLimitations(root);
  const byId = new Map<string, EconomicKnownLimitation>();
  for (const row of BUILTIN_KNOWN_LIMITATIONS) {
    byId.set(row.id, Object.freeze({ ...row, hiddenFromReleaseNotes: false as const }));
  }
  for (const row of security) {
    byId.set(row.id, Object.freeze({
      id: row.id,
      title: row.title,
      severity: row.severity,
      source: row.source,
      hiddenFromReleaseNotes: false,
    }));
  }
  for (const row of ECONOMIC_KNOWN_LIMITATIONS) {
    byId.set(row.id, row);
  }
  return Object.freeze([...byId.values()]);
}

export function economicLimitationsHidden(rows: readonly EconomicKnownLimitation[]): boolean {
  return rows.some((row) => row.hiddenFromReleaseNotes !== false);
}
