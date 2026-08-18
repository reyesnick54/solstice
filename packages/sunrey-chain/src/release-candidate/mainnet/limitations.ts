import { loadEconomicKnownLimitations } from '../economic/limitations.ts';
import { BUILTIN_KNOWN_LIMITATIONS, loadKnownSecurityLimitations } from '../limitations.ts';
import type { MainnetReleaseKnownLimitation } from './types.ts';

export const MAINNET_KNOWN_LIMITATIONS: readonly MainnetReleaseKnownLimitation[] = Object.freeze([
  Object.freeze({
    id: 'NOT_MAINNET_LAUNCH',
    title: 'This is a Mainnet Release Candidate. It does not launch or activate the production network.',
    severity: 'critical',
    source: 'chunk-84',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'ENGINEERING_QUALIFIED_IS_NOT_AUTHORIZED_CANDIDATE',
    title: 'ENGINEERING_QUALIFIED is an engineering result. It is not AUTHORIZED_CANDIDATE and is not launch authorization.',
    severity: 'critical',
    source: 'chunk-65',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'TICKERS_NOT_ASSIGNED',
    title: 'Production tickers are not assigned.',
    severity: 'critical',
    source: 'chunk-53',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'PRODUCTION_TOKENOMICS_UNCONFIGURED',
    title: 'Production tokenomics values remain UNCONFIGURED.',
    severity: 'critical',
    source: 'chunk-71',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'EXTERNAL_HSM_EVIDENCE_ABSENT',
    title: 'External HSM evidence is absent. Simulation/software providers cannot satisfy hardware policy.',
    severity: 'critical',
    source: 'chunk-64',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'PROVIDER_AGREEMENTS_ABSENT',
    title: 'Provider agreements are absent. No provider is production eligible.',
    severity: 'critical',
    source: 'chunk-82',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'EXTERNAL_AUDIT_INCOMPLETE',
    title: 'Independent external audit is incomplete. Chunk 62/83 engineering preparation is not an audit pass.',
    severity: 'critical',
    source: 'chunk-83',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'LEGAL_REGULATORY_INCOMPLETE',
    title: 'Legal and regulatory evidence remains incomplete. Missing evidence stays missing.',
    severity: 'critical',
    source: 'chunk-65',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'PRODUCTION_CEREMONY_EVIDENCE_SEPARATE',
    title: 'Production root-of-trust ceremony evidence remains separate until Chunk 85.',
    severity: 'warning',
    source: 'chunk-64',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'RELEASE_SIGNATURE_NOT_LAUNCH',
    title: 'ReleaseAuthority signs the Mainnet RC bundle only. The signature cannot activate the network.',
    severity: 'critical',
    source: 'chunk-59',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'AI_CANNOT_AUTHORIZE_RELEASE',
    title: 'CI and AI actors cannot synthesize human release approval.',
    severity: 'critical',
    source: 'chunk-65',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'EXTENDED_DURATION_NOT_CLAIMED',
    title: 'Soak, extended fuzz, formal extended, full adversarial range, and long-horizon economics are not claimed unless executed.',
    severity: 'warning',
    source: 'chunk-84',
    hiddenFromReleaseNotes: false,
  }),
  Object.freeze({
    id: 'SIMULATION_ENVIRONMENT',
    title: 'ENVIRONMENT stays simulation. Every LIVE_* flag stays false.',
    severity: 'critical',
    source: 'packages/config',
    hiddenFromReleaseNotes: false,
  }),
]);

export function loadMainnetKnownLimitations(root: string): readonly MainnetReleaseKnownLimitation[] {
  const byId = new Map<string, MainnetReleaseKnownLimitation>();
  for (const row of BUILTIN_KNOWN_LIMITATIONS) {
    byId.set(row.id, Object.freeze({ ...row, hiddenFromReleaseNotes: false as const }));
  }
  for (const row of loadKnownSecurityLimitations(root)) {
    byId.set(row.id, Object.freeze({
      id: row.id,
      title: row.title,
      severity: row.severity,
      source: row.source,
      hiddenFromReleaseNotes: false,
    }));
  }
  for (const row of loadEconomicKnownLimitations(root)) {
    byId.set(row.id, Object.freeze({
      id: row.id,
      title: row.title,
      severity: row.severity,
      source: row.source,
      hiddenFromReleaseNotes: false,
    }));
  }
  for (const row of MAINNET_KNOWN_LIMITATIONS) {
    byId.set(row.id, row);
  }
  return Object.freeze([...byId.values()]);
}

export function mainnetLimitationsHidden(rows: readonly MainnetReleaseKnownLimitation[]): boolean {
  return rows.some((row) => row.hiddenFromReleaseNotes !== false);
}
