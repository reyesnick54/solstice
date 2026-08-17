import {
  blockedPackageFinding,
  loadCryptoInventory,
  loadDependencyPolicy,
  unlockedDependencyFinding,
  unregisteredCryptoFinding,
} from './policy.ts';
import { collectSoftwareInventory, lockfileEnforcement, networkDependencyPolicyFindings } from './inventory.ts';
import type { AuditFinding, CryptoPrimitive } from './types.ts';

export type AuditReport = {
  readonly findings: readonly AuditFinding[];
  readonly ok: boolean;
  readonly counts: Readonly<Record<AuditFinding['kind'], number>>;
};

const EMPTY_COUNTS: Record<AuditFinding['kind'], number> = {
  known_advisory: 0,
  unmaintained_warning: 0,
  license_issue: 0,
  yanked_dependency: 0,
  duplicate_risk_warning: 0,
  unregistered_crypto: 0,
  unlocked_dependency: 0,
  blocked_package: 0,
  tampered_artifact: 0,
};

export function countFindings(findings: readonly AuditFinding[]): Record<AuditFinding['kind'], number> {
  const counts = { ...EMPTY_COUNTS };
  for (const finding of findings) {
    counts[finding.kind] += 1;
  }
  return counts;
}

export function classifyEcosystemAdvisoryJson(
  source: 'npm' | 'cargo' | 'container',
  payload: {
    readonly name: string;
    readonly severity: 'critical' | 'high' | 'moderate' | 'low';
    readonly kind?: AuditFinding['kind'];
    readonly yanked?: boolean;
    readonly unmaintained?: boolean;
  },
): AuditFinding {
  if (payload.yanked) {
    return classifyAdvisory('yanked_dependency', payload.name, `${source} yanked dependency`, 'fail');
  }
  if (payload.unmaintained) {
    return classifyAdvisory('unmaintained_warning', payload.name, `${source} unmaintained warning`, 'warn');
  }
  const high = payload.severity === 'critical' || payload.severity === 'high';
  return classifyAdvisory(
    payload.kind ?? 'known_advisory',
    payload.name,
    `${source} ${payload.severity} advisory (offline classification; no registry call)`,
    high ? 'fail' : 'warn',
  );
}

export function auditDependencies(root: string, extras: readonly AuditFinding[] = []): AuditReport {
  const policy = loadDependencyPolicy(root);
  const inventory = collectSoftwareInventory(root);
  const findings: AuditFinding[] = [...lockfileEnforcement(root), ...networkDependencyPolicyFindings(root), ...extras];
  const seen = new Map<string, number>();
  for (const row of inventory) {
    const blocked = blockedPackageFinding(policy, row.name, row.ecosystem);
    if (blocked) {
      findings.push(blocked);
    }
    const key = `${row.ecosystem}:${row.name}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (row.direct && row.license === 'UNKNOWN' && row.ecosystem === 'npm') {
      findings.push({
        kind: 'license_issue',
        name: row.name,
        severity: 'report',
        detail: 'license is unknown and flagged for human/legal review; no legal conclusion is made',
      });
    }
  }
  for (const [key, count] of seen) {
    if (count > 4) {
      findings.push({
        kind: 'duplicate_risk_warning',
        name: key,
        severity: 'warn',
        detail: `duplicate-risk warning: ${count} lock entries share this identity`,
      });
    }
  }
  return {
    findings,
    ok: findings.every((row) => row.severity !== 'fail'),
    counts: countFindings(findings),
  };
}

export function auditMaliciousFixtures(input: {
  readonly root: string;
  readonly packages: readonly {
    readonly name: string;
    readonly ecosystem: string;
    readonly primitives?: readonly CryptoPrimitive[];
    readonly lockfilePresent?: boolean;
  }[];
}): AuditReport {
  const policy = loadDependencyPolicy(input.root);
  const inventory = loadCryptoInventory(input.root);
  const findings: AuditFinding[] = [];
  for (const row of input.packages) {
    const blocked = blockedPackageFinding(policy, row.name, row.ecosystem);
    if (blocked) {
      findings.push(blocked);
    }
    const crypto = unregisteredCryptoFinding(row.name, row.primitives ?? [], inventory);
    if (crypto) {
      findings.push(crypto);
    }
    const unlocked = unlockedDependencyFinding(row.lockfilePresent ?? true, row.name);
    if (unlocked) {
      findings.push(unlocked);
    }
  }
  return {
    findings,
    ok: findings.every((row) => row.severity !== 'fail'),
    counts: countFindings(findings),
  };
}

export function classifyAdvisory(
  kind: AuditFinding['kind'],
  name: string,
  detail: string,
  severity: AuditFinding['severity'] = 'fail',
): AuditFinding {
  return { kind, name, severity, detail };
}
