import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { sha256Text } from '../supply-chain/inventory.ts';
import {
  buildTargetSbom,
  collectSoftwareInventory,
  localTestReleaseAuthority,
  sbomDigest,
  signArtifact,
  verifySignature,
} from '../supply-chain/index.ts';
import { providerAcceptanceAuditPayload } from '../providers/audit.ts';
import { ATTACK_SURFACE } from './attack-surface.ts';
import { REVIEWER_CHECKLIST } from './checklist.ts';
import { CONSENSUS_REVIEW_PACKAGE } from './consensus-package.ts';
import { SECURITY_CONTROLS } from './controls.ts';
import { CRYPTO_REVIEW_PACKAGE } from './crypto-package.ts';
import { DATA_FLOWS, emitDataFlowText } from './data-flows.ts';
import { ECONOMIC_REVIEW_PACKAGE } from './economic-package.ts';
import { evidenceMap } from './evidence.ts';
import { KNOWN_SECURITY_LIMITATIONS } from './limitations.ts';
import { MOONREY_REVIEW_PACKAGE } from './moonrey-package.ts';
import { CODE_OWNERSHIP_MAP } from './ownership.ts';
import { PRIVACY_REVIEW_PACKAGE } from './privacy-package.ts';
import { REQUIRED_REVIEW_ARTIFACTS, buildReadinessReport } from './readiness.ts';
import { readGenesisHash, sourceReproducibility } from './reproducibility.ts';
import { emitAuditScopeYaml, REVIEW_DOMAIN_RECORDS } from './scope.ts';
import { SANITIZED_SAMPLE_CONFIG, assertSecretFree, secretExclusionFindings } from './secrets.ts';
import { THREAT_MODELS } from './threats.ts';
import { TRUST_BOUNDARIES } from './trust-boundaries.ts';
import { PROTECTED_ASSETS } from './assets.ts';
import {
  AUDIT_BUNDLE_SCHEMA_VERSION,
  AUDIT_GENERATED_AT_DETERMINISTIC,
  AUDIT_PROTOCOL_VERSION,
  AUDIT_TESTNET_NETWORK_ID,
  type ArtifactHash,
  type AuditBundleManifest,
  type BundleVerificationResult,
  type SignedAuditBundle,
} from './types.ts';

export const BUNDLE_RELATIVE_DIR = 'dist/sunrey-audit';

const SOURCE_DOCUMENTS = [
  'docs/architecture/manifest.json',
  'docs/architecture/adr/README.md',
  'docs/architecture/constitution.md',
  'docs/architecture/sunrey-blockchain-protocol.json',
  'docs/security/sunrey-blockchain-threat-model.md',
  'docs/security/cryptographic-inventory.json',
  'docs/security/chunk-59-supply-chain.md',
  'docs/security/chunk-60-post-quantum-integration.md',
  'docs/assurance/chunk-56-fuzzing.md',
  'docs/assurance/chunk-57-adversarial-range.md',
  'docs/performance/chunk-58-performance.md',
  'docs/audit/README.md',
  'docs/audit/reviewer-guide.md',
  'docs/audit/scope.md',
  'docs/audit/trust-boundaries.md',
  'docs/audit/control-catalog.md',
  'docs/audit/known-limitations.md',
  'docs/audit/finding-lifecycle.md',
  'docs/audit/reproduction.md',
  'docs/audit/chunk-83-audit-remediation.md',
  'docs/audit/remediation-evidence.md',
  'docs/audit/external-retest.md',
  'docs/audit/security-risk-acceptance.md',
  'docs/runbooks/security-finding-remediation.md',
  'packages/sunrey-chain/rust/crates/consensus/ALGORITHM.md',
  'packages/sunrey-chain/src/assurance/coverage.ts',
  'packages/sunrey-chain/perf/baseline/manifest.json',
  'packages/sunrey-chain/fixtures/testnet/genesis-hash.txt',
  'packages/sunrey-chain/audit/audit-scope.yaml',
  'packages/sunrey-chain/audit/sample-config.json',
  'docs/providers/chunk-82-production-provider-acceptance.md',
  'docs/providers/provider-evidence.md',
] as const;

const EVIDENCE_REFERENCES = [
  'packages/sunrey-chain/src/assurance',
  'packages/sunrey-range',
  'packages/sunrey-chain/src/perf',
  'packages/sunrey-chain/src/supply-chain',
  'tests/assurance',
] as const;

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hashArtifact(path: string, body: string): ArtifactHash {
  const kind = path.startsWith('generated/')
    ? 'generated'
    : path.includes('sample-config')
      ? 'config'
      : path.includes('evidence') || path.includes('assurance') || path.includes('range') || path.includes('perf')
        ? 'evidence'
        : 'document';
  return { path, sha256: sha256Text(body), kind };
}

export function formalReportPayload(): unknown {
  return Object.freeze({
    kind: 'formal-smoke',
    machineCheckedProofs: 'NOT_APPLICABLE',
    propertyHarness: 'sunrey-assurance/1',
    coverage: 'packages/sunrey-chain/src/assurance/coverage.ts',
    note: 'Chunk 56 is fuzz/property assurance, not machine-checked proofs.',
  });
}

export function rangeReportPayload(): unknown {
  return Object.freeze({
    kind: 'adversarial-smoke',
    owner: 'packages/sunrey-range',
    command: 'npm run sunrey-range -- campaign --smoke',
    note: 'Deterministic in-process red actors. Detector output is not legal guilt.',
  });
}

export function generateAuditBundle(root: string, options: {
  readonly sourceCommit?: string;
  readonly generatedTimestamp?: string;
  readonly outDir?: string;
} = {}): {
  readonly outDir: string;
  readonly manifest: AuditBundleManifest;
  readonly signed: SignedAuditBundle;
  readonly secretFindings: readonly string[];
} {
  const sourceCommit = options.sourceCommit ?? process.env.GITHUB_SHA ?? 'local';
  const generatedTimestamp = options.generatedTimestamp ?? AUDIT_GENERATED_AT_DETERMINISTIC;
  const outDir = options.outDir ?? join(root, BUNDLE_RELATIVE_DIR);
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(join(outDir, 'documents'), { recursive: true });
  mkdirSync(join(outDir, 'generated'), { recursive: true });
  mkdirSync(join(outDir, 'evidence'), { recursive: true });

  const artifacts = new Map<string, string>();
  for (const rel of SOURCE_DOCUMENTS) {
    const full = join(root, rel);
    if (!existsSync(full)) {
      continue;
    }
    const body = readFileSync(full, 'utf8');
    const dest = join('documents', rel.replaceAll('/', '__'));
    artifacts.set(dest, body);
  }

  const generated: Record<string, unknown> = {
    'generated/audit-scope.yaml': emitAuditScopeYaml(),
    'generated/ownership.json': CODE_OWNERSHIP_MAP,
    'generated/trust-boundaries.json': TRUST_BOUNDARIES,
    'generated/assets.json': PROTECTED_ASSETS,
    'generated/threat-models.json': THREAT_MODELS,
    'generated/controls.json': SECURITY_CONTROLS,
    'generated/evidence-map.json': evidenceMap(),
    'generated/crypto-review.json': CRYPTO_REVIEW_PACKAGE,
    'generated/consensus-review.json': CONSENSUS_REVIEW_PACKAGE,
    'generated/economic-review.json': ECONOMIC_REVIEW_PACKAGE,
    'generated/moonrey-review.json': MOONREY_REVIEW_PACKAGE,
    'generated/privacy-review.json': PRIVACY_REVIEW_PACKAGE,
    'generated/attack-surface.json': ATTACK_SURFACE,
    'generated/checklist.json': REVIEWER_CHECKLIST,
    'generated/known-limitations.json': KNOWN_SECURITY_LIMITATIONS,
    'generated/provider-acceptance.json': providerAcceptanceAuditPayload(),
    'generated/sample-config.json': SANITIZED_SAMPLE_CONFIG,
    'generated/source-reproducibility.json': sourceReproducibility(root, sourceCommit),
    'generated/review-instructions.md': [
      '# Review instructions',
      '',
      '1. npm run sunrey-audit -- verify dist/sunrey-audit',
      '2. Read docs/audit/reviewer-guide.md',
      '3. npm run sunrey-audit -- reproduce --smoke',
      '4. Inspect generated review packages in this bundle',
      '5. This package does not claim an external audit occurred or passed.',
      '',
    ].join('\n'),
  };
  for (const flow of DATA_FLOWS) {
    generated[`generated/data-flow-${flow.flow_id}.txt`] = emitDataFlowText(flow);
  }

  for (const [path, value] of Object.entries(generated)) {
    artifacts.set(path, typeof value === 'string' ? value : stableJson(value));
  }

  const inventory = collectSoftwareInventory(root);
  const sbom = buildTargetSbom('sunrey-node', inventory, sha256Text(sourceCommit));
  const formal = formalReportPayload();
  const range = rangeReportPayload();
  artifacts.set('evidence/sbom.json', stableJson(sbom));
  artifacts.set('evidence/formal-report.json', stableJson(formal));
  artifacts.set('evidence/security-range-report.json', stableJson(range));

  const hashes: ArtifactHash[] = [];
  let bundleText = '';
  for (const path of [...artifacts.keys()].sort()) {
    const body = artifacts.get(path)!;
    assertSecretFree(body, path);
    writeFileSync(join(outDir, path), body);
    const hashed = hashArtifact(path, body);
    hashes.push(hashed);
    bundleText += `${path}\0${hashed.sha256}\n`;
  }

  const missing = REQUIRED_REVIEW_ARTIFACTS.filter((rel) => !existsSync(join(root, rel)));
  const readiness = buildReadinessReport(missing);
  const readinessBody = stableJson(readiness);
  writeFileSync(join(outDir, 'generated/readiness.json'), readinessBody);
  hashes.push(hashArtifact('generated/readiness.json', readinessBody));
  bundleText += `generated/readiness.json\0${sha256Text(readinessBody)}\n`;

  const manifest: AuditBundleManifest = Object.freeze({
    bundle_id: `bun_sunrey_audit_v1_${sourceCommit.slice(0, 12)}`,
    source_commit: sourceCommit,
    protocol_version: AUDIT_PROTOCOL_VERSION,
    testnet_network_id: AUDIT_TESTNET_NETWORK_ID,
    genesis_hash: readGenesisHash(root),
    included_documents: Object.freeze(hashes.filter((row) => row.kind === 'document').map((row) => row.path)),
    included_evidence: Object.freeze(hashes.filter((row) => row.kind === 'evidence').map((row) => row.path)),
    artifact_hashes: Object.freeze(hashes),
    sbom_digest: sbomDigest(sbom),
    formal_report_digest: sha256Text(stableJson(formal)),
    security_range_report_digest: sha256Text(stableJson(range)),
    generated_timestamp: generatedTimestamp,
    bundle_schema_version: AUDIT_BUNDLE_SCHEMA_VERSION,
    claims_external_audit_completed: false,
    environment: 'simulation',
  });
  const manifestBody = stableJson(manifest);
  writeFileSync(join(outDir, 'manifest.json'), manifestBody);

  const { authority } = localTestReleaseAuthority();
  const canonical = Buffer.from(bundleText + manifestBody);
  const signature = signArtifact(canonical, authority);
  const signed: SignedAuditBundle = Object.freeze({
    manifest,
    signature,
    authorityId: authority.authorityId,
  });
  writeFileSync(join(outDir, 'signature.json'), stableJson(signed));
  writeFileSync(join(outDir, 'canonical-hash.txt'), `${sha256Text(canonical)}\n`);

  const secretFindings = [...artifacts.values()].flatMap((body) => secretExclusionFindings(body));
  return { outDir, manifest, signed, secretFindings };
}

export function verifyAuditBundle(bundleDir: string): BundleVerificationResult {
  const manifestPath = join(bundleDir, 'manifest.json');
  const signaturePath = join(bundleDir, 'signature.json');
  const checks: { id: string; ok: boolean; detail: string }[] = [];
  if (!existsSync(manifestPath) || !existsSync(signaturePath)) {
    return { ok: false, checks: [{ id: 'present', ok: false, detail: 'manifest or signature missing' }] };
  }
  const manifestBody = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestBody) as AuditBundleManifest;
  const signed = JSON.parse(readFileSync(signaturePath, 'utf8')) as SignedAuditBundle;
  let bundleText = '';
  let hashesOk = true;
  for (const row of manifest.artifact_hashes) {
    const full = join(bundleDir, row.path);
    if (!existsSync(full)) {
      hashesOk = false;
      checks.push({ id: `present:${row.path}`, ok: false, detail: 'missing' });
      continue;
    }
    const body = readFileSync(full, 'utf8');
    const digest = sha256Text(body);
    const ok = digest === row.sha256;
    if (!ok) {
      hashesOk = false;
    }
    checks.push({ id: `hash:${row.path}`, ok, detail: digest });
    bundleText += `${row.path}\0${digest}\n`;
  }
  const canonical = Buffer.from(bundleText + manifestBody);
  const expected = sha256Text(canonical);
  const { authority } = localTestReleaseAuthority();
  const signatureOk = verifySignature(canonical, signed.signature, authority)
    && signed.signature.artifactDigest === expected;
  checks.push({ id: 'artifact-hashes', ok: hashesOk, detail: hashesOk ? 'matched' : 'tamper' });
  checks.push({ id: 'signature', ok: signatureOk, detail: signed.authorityId });
  checks.push({
    id: 'schema',
    ok: manifest.bundle_schema_version === AUDIT_BUNDLE_SCHEMA_VERSION,
    detail: String(manifest.bundle_schema_version),
  });
  checks.push({
    id: 'no-external-audit-claim',
    ok: manifest.claims_external_audit_completed === false,
    detail: 'engineering package only',
  });
  checks.push({
    id: 'network',
    ok: manifest.testnet_network_id === AUDIT_TESTNET_NETWORK_ID,
    detail: manifest.testnet_network_id,
  });
  return { ok: checks.every((row) => row.ok), checks };
}

export function tamperBundleFile(bundleDir: string, relativePath: string, replacement: string): void {
  writeFileSync(join(bundleDir, relativePath), replacement);
}
