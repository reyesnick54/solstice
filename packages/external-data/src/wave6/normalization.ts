/**
 * Wave 6 — employment type, remote status, salary, and skill normalization.
 */

import type { EmploymentType, RemoteStatus, SalaryPeriod } from './types.ts';

const EMPLOYMENT_TYPE_MAP: Record<string, EmploymentType> = {
  'full-time': 'FULL_TIME',
  'full time': 'FULL_TIME',
  'fulltime': 'FULL_TIME',
  'ft': 'FULL_TIME',
  'permanent': 'FULL_TIME',
  'part-time': 'PART_TIME',
  'part time': 'PART_TIME',
  'pt': 'PART_TIME',
  'contract': 'CONTRACT',
  'contractor': 'CONTRACT',
  'freelance': 'FREELANCE',
  'temporary': 'TEMPORARY',
  'temp': 'TEMPORARY',
  'internship': 'INTERNSHIP',
  'intern': 'INTERNSHIP',
};

export function normalizeEmploymentType(raw: string | null | undefined): {
  readonly normalized: EmploymentType;
  readonly providerNative: string | null;
} {
  if (!raw || raw.trim() === '') {
    return { normalized: 'UNKNOWN', providerNative: null };
  }
  const lower = raw.trim().toLowerCase();
  const mapped = EMPLOYMENT_TYPE_MAP[lower];
  if (mapped) {
    return { normalized: mapped, providerNative: raw };
  }
  return { normalized: 'OTHER', providerNative: raw };
}

const REMOTE_STATUS_MAP: Record<string, RemoteStatus> = {
  'remote': 'REMOTE',
  'fully remote': 'REMOTE',
  '100% remote': 'REMOTE',
  'work from home': 'REMOTE',
  'wfh': 'REMOTE',
  'hybrid': 'HYBRID',
  'partially remote': 'HYBRID',
  'flexible': 'HYBRID',
  'onsite': 'ONSITE',
  'on-site': 'ONSITE',
  'on site': 'ONSITE',
  'in-office': 'ONSITE',
  'in office': 'ONSITE',
};

export function normalizeRemoteStatus(
  raw: string | null | undefined,
  explicitRemoteFlag?: boolean | null,
): RemoteStatus {
  if (explicitRemoteFlag === true) return 'REMOTE';
  if (explicitRemoteFlag === false) return 'ONSITE';
  if (!raw || raw.trim() === '') return 'UNKNOWN';
  const lower = raw.trim().toLowerCase();
  return REMOTE_STATUS_MAP[lower] ?? 'UNKNOWN';
}

const SALARY_PERIOD_MAP: Record<string, SalaryPeriod> = {
  'hour': 'HOURLY',
  'hourly': 'HOURLY',
  'hr': 'HOURLY',
  'day': 'DAILY',
  'daily': 'DAILY',
  'month': 'MONTHLY',
  'monthly': 'MONTHLY',
  'year': 'ANNUAL',
  'annual': 'ANNUAL',
  'annually': 'ANNUAL',
  'yearly': 'ANNUAL',
  'project': 'PROJECT',
};

export function normalizeSalaryPeriod(raw: string | null | undefined): SalaryPeriod {
  if (!raw) return 'ANNUAL';
  const lower = raw.trim().toLowerCase();
  return SALARY_PERIOD_MAP[lower] ?? 'ANNUAL';
}

/** High-confidence skill alias map — ambiguous terms are not normalized. */
const SKILL_ALIAS_MAP: ReadonlyMap<string, string> = new Map([
  ['js', 'JavaScript'],
  ['javascript', 'JavaScript'],
  ['ts', 'TypeScript'],
  ['typescript', 'TypeScript'],
  ['py', 'Python'],
  ['python', 'Python'],
  ['golang', 'Go'],
  ['go', 'Go'],
  ['k8s', 'Kubernetes'],
  ['kubernetes', 'Kubernetes'],
  ['react.js', 'React'],
  ['reactjs', 'React'],
  ['react', 'React'],
  ['node.js', 'Node.js'],
  ['nodejs', 'Node.js'],
  ['node', 'Node.js'],
  ['ml', 'Machine Learning'],
  ['machine learning', 'Machine Learning'],
  ['ai', 'Artificial Intelligence'],
  ['artificial intelligence', 'Artificial Intelligence'],
  ['sql', 'SQL'],
  ['aws', 'Amazon Web Services'],
  ['gcp', 'Google Cloud Platform'],
  ['graphql', 'GraphQL'],
]);

export function normalizeSkillLabel(raw: string): { readonly canonical: string | null; readonly raw: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { canonical: null, raw: trimmed };
  const lower = trimmed.toLowerCase();
  const canonical = SKILL_ALIAS_MAP.get(lower);
  if (canonical) return { canonical, raw: trimmed };
  // Do not over-normalize ambiguous short terms
  if (trimmed.length <= 2) return { canonical: null, raw: trimmed };
  return { canonical: null, raw: trimmed };
}

export function normalizeSkillLabels(labels: readonly string[]): {
  readonly canonical: readonly string[];
  readonly raw: readonly string[];
} {
  const canonicalSet = new Set<string>();
  const raw: string[] = [];
  for (const label of labels) {
    const result = normalizeSkillLabel(label);
    raw.push(result.raw);
    if (result.canonical) canonicalSet.add(result.canonical);
  }
  return { canonical: Object.freeze([...canonicalSet]), raw: Object.freeze(raw) };
}
