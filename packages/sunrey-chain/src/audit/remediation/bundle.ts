import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { hashCanonical } from './chain.ts';
import { publicFindingView } from './disclosure.ts';
import { secretExclusionFindings } from '../secrets.ts';
import {
  TEST_FIXTURE_NOT_EXTERNAL_AUDIT,
  type AuditRemediationBundle,
  type ExternalSecurityFinding,
  type ExternalSecurityReview,
  type FindingEvidenceChainRecord,
  type FindingRegressionEvidence,
  type FindingRemediationEvidence,
  type FindingRemediationPlan,
  type FindingRetestRequest,
  type FindingRetestResult,
  type SecurityRiskAcceptance,
  type SecurityReviewStatusReport,
} from './types.ts';

export const REMEDIATION_BUNDLE_RELATIVE_DIR = 'dist/sunrey-audit-remediation';

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function generateAuditRemediationBundle(input: {
  readonly root: string;
  readonly sourceCommit: string;
  readonly review: ExternalSecurityReview | null;
  readonly findings: readonly ExternalSecurityFinding[];
  readonly plans: readonly FindingRemediationPlan[];
  readonly remediationEvidence: readonly FindingRemediationEvidence[];
  readonly regressions: readonly FindingRegressionEvidence[];
  readonly retestRequests: readonly FindingRetestRequest[];
  readonly retestResults: readonly FindingRetestResult[];
  readonly acceptedRisks: readonly SecurityRiskAcceptance[];
  readonly chain: readonly FindingEvidenceChainRecord[];
  readonly status: SecurityReviewStatusReport;
  readonly outDir?: string;
  readonly generatedAtUtc?: string;
}): {
  readonly outDir: string;
  readonly bundle: AuditRemediationBundle;
  readonly secretFindings: readonly string[];
} {
  const outDir = input.outDir ?? join(input.root, REMEDIATION_BUNDLE_RELATIVE_DIR);
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  const publicFindings = input.findings.map(publicFindingView);
  const artifacts: Record<string, string> = {
    'review.json': stableJson(input.review),
    'findings.json': stableJson(input.findings),
    'findings.public.json': stableJson(publicFindings),
    'plans.json': stableJson(input.plans),
    'remediation-evidence.json': stableJson(input.remediationEvidence),
    'regressions.json': stableJson(input.regressions),
    'retest-requests.json': stableJson(input.retestRequests),
    'retest-results.json': stableJson(input.retestResults),
    'accepted-risks.json': stableJson(input.acceptedRisks),
    'evidence-chain.json': stableJson(input.chain),
    'status.json': stableJson(input.status),
  };

  const secretFindings: string[] = [];
  const hashes: { path: string; sha256: string }[] = [];
  for (const [path, body] of Object.entries(artifacts).sort(([a], [b]) => a.localeCompare(b))) {
    secretFindings.push(...secretExclusionFindings(body).map((row) => `${path}: ${row}`));
    writeFileSync(join(outDir, path), body);
    hashes.push({ path, sha256: hashCanonical(body) });
  }
  if (secretFindings.length > 0) {
    throw new Error(`secret evidence excluded from audit remediation bundle: ${secretFindings.join('; ')}`);
  }

  const fixtureLabel = input.review?.fixtureLabel
    ?? (input.findings.some((row) => row.fixtureLabel) ? TEST_FIXTURE_NOT_EXTERNAL_AUDIT : null);
  const bundle: AuditRemediationBundle = Object.freeze({
    bundleId: hashCanonical({ sourceCommit: input.sourceCommit, hashes }),
    reviewId: input.review?.reviewId ?? null,
    sourceCommit: input.sourceCommit,
    artifactHashes: Object.freeze(hashes),
    bundleDigest: hashCanonical(hashes),
    generatedAtUtc: input.generatedAtUtc ?? '1970-01-01T00:00:00Z',
    claimsExternalAuditCompleted: false,
    fixtureLabel,
  });
  writeFileSync(join(outDir, 'bundle.json'), stableJson(bundle));
  return { outDir, bundle, secretFindings };
}

export function verifyAuditRemediationBundle(outDir: string): {
  readonly ok: boolean;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
} {
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  const manifestPath = join(outDir, 'bundle.json');
  if (!existsSync(manifestPath)) {
    return { ok: false, checks: [{ id: 'manifest', ok: false, detail: 'bundle.json missing' }] };
  }
  const bundle = JSON.parse(readFileSync(manifestPath, 'utf8')) as AuditRemediationBundle;
  checks.push({
    id: 'claims',
    ok: bundle.claimsExternalAuditCompleted === false,
    detail: 'bundle must not claim an external audit completed',
  });
  for (const row of bundle.artifactHashes) {
    const full = join(outDir, row.path);
    if (!existsSync(full)) {
      checks.push({ id: `hash:${row.path}`, ok: false, detail: 'missing artifact' });
      continue;
    }
    const actual = hashCanonical(readFileSync(full, 'utf8'));
    checks.push({
      id: `hash:${row.path}`,
      ok: actual === row.sha256,
      detail: actual === row.sha256 ? 'match' : 'changed findings or results invalidate the bundle',
    });
  }
  const recomputed = hashCanonical(bundle.artifactHashes);
  checks.push({
    id: 'bundle-digest',
    ok: recomputed === bundle.bundleDigest,
    detail: recomputed === bundle.bundleDigest ? 'match' : 'bundle digest mismatch',
  });
  return { ok: checks.every((row) => row.ok), checks };
}

export function tamperRemediationBundleFile(outDir: string, relative: string, body: string): void {
  writeFileSync(join(outDir, relative), body);
}
