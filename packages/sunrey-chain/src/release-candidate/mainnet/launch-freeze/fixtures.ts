import { ExternalEvidenceRegistry } from '../../../mainnet/external-evidence/registry.ts';
import { fixtureSecurityAuditDraft } from '../../../mainnet/external-evidence/fixtures.ts';
import { assembleLaunchCandidateFreeze, evaluateCurrentRepositoryLaunchFreeze, inputFromFreeze } from './assemble.ts';
import { collectCurrentRepositoryLaunchBindings } from './bindings.ts';
import type { LaunchFreezeEvaluation, ProductionLaunchCandidateFreeze, ProductionLaunchCandidateFreezeInput } from './types.ts';

export function currentRepositoryLaunchFreeze(root = process.cwd()): LaunchFreezeEvaluation {
  return evaluateCurrentRepositoryLaunchFreeze(root);
}

export function fixtureEvidenceRegistry(expiresAtUtc = '2026-08-21T12:00:00.000Z'): ExternalEvidenceRegistry {
  const registry = new ExternalEvidenceRegistry();
  const registered = registry.register(
    fixtureSecurityAuditDraft({
      recordId: 'ext-ev-fixture-provider-contract',
      evidenceClass: 'SERVICE_CONTRACT',
      subjectType: 'PROVIDER',
      subjectId: 'fixture-kyc-prod',
      expiresAtUtc,
      fixture: true,
      engineeringOnly: true,
    }),
  );
  if (!registered.ok) {
    throw new TypeError(registered.error.message);
  }
  return registry;
}

export function fixtureEvidenceLaunchFreeze(
  root = process.cwd(),
  nowUtc = '2026-08-21T00:00:00.000Z',
  expiresAtUtc = '2026-08-21T12:00:00.000Z',
): LaunchFreezeEvaluation {
  return evaluateCurrentRepositoryLaunchFreeze(root, {
    nowUtc,
    evidenceRegistry: fixtureEvidenceRegistry(expiresAtUtc),
  });
}

export function withLaunchFreezeOverrides(
  base: ProductionLaunchCandidateFreeze,
  overrides: Partial<ProductionLaunchCandidateFreezeInput>,
): ProductionLaunchCandidateFreeze {
  return assembleLaunchCandidateFreeze({
    ...inputFromFreeze(base),
    ...overrides,
  });
}

export function collectedBindingsForTests(root = process.cwd()) {
  return collectCurrentRepositoryLaunchBindings(root, {
    sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
}
