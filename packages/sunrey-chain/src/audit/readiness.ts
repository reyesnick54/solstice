import { SECURITY_CONTROLS } from './controls.ts';
import { KNOWN_SECURITY_LIMITATIONS } from './limitations.ts';
import { REVIEW_DOMAIN_RECORDS, scopeIsComplete } from './scope.ts';
import { THREAT_MODELS } from './threats.ts';
import type { AuditReadinessReport } from './types.ts';

export const REQUIRED_REVIEW_ARTIFACTS = [
  'docs/architecture/manifest.json',
  'docs/architecture/adr/README.md',
  'docs/security/cryptographic-inventory.json',
  'docs/security/sunrey-blockchain-threat-model.md',
  'packages/sunrey-chain/src/assurance/coverage.ts',
  'packages/sunrey-chain/perf/baseline/manifest.json',
  'packages/sunrey-chain/fixtures/testnet/genesis-hash.txt',
  'docs/audit/reviewer-guide.md',
] as const;

export function classifyReadiness(input: {
  readonly missingArtifacts: readonly string[];
  readonly knownLimitationCount: number;
}): AuditReadinessReport['category'] {
  if (input.missingArtifacts.length > 0) {
    return 'MISSING_REVIEW_ARTIFACT';
  }
  if (input.knownLimitationCount > 0) {
    return 'READY_WITH_KNOWN_LIMITATIONS';
  }
  return 'READY_FOR_EXTERNAL_REVIEW';
}

export function buildReadinessReport(missingArtifacts: readonly string[] = []): AuditReadinessReport {
  const knownLimitationCount = KNOWN_SECURITY_LIMITATIONS.length;
  const category = classifyReadiness({ missingArtifacts, knownLimitationCount });
  return Object.freeze({
    category,
    claims_external_audit_completed: false,
    missingArtifacts,
    knownLimitationCount,
    controlCount: SECURITY_CONTROLS.length,
    threatModelCount: THREAT_MODELS.length,
    reviewDomainCount: REVIEW_DOMAIN_RECORDS.length,
    notes: scopeIsComplete()
      ? 'Engineering package status only. This is not an audit result and does not claim an external review occurred.'
      : 'Review domain set is incomplete.',
  });
}
