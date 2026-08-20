import { assertWorkloadMayUseKey } from './auth.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult, type CustodyKeyLifecycle } from './types.ts';

export type CustodyKmsKeyVersion = {
  readonly keyId: string;
  readonly version: number;
  readonly lifecycle: CustodyKeyLifecycle;
  readonly exportable: false;
};

const versions = new Map<string, CustodyKmsKeyVersion[]>();

export function registerKmsKey(keyId: string): CustodyKmsKeyVersion {
  const version: CustodyKmsKeyVersion = Object.freeze({
    keyId,
    version: 1,
    lifecycle: 'ACTIVE',
    exportable: false,
  });
  versions.set(keyId, [version]);
  return version;
}

export function rotateKmsKey(keyId: string): CustodyCandidateResult<CustodyKmsKeyVersion> {
  const history = versions.get(keyId);
  if (!history) {
    return candidateErr('UNKNOWN_KEY', 'KMS key is not registered');
  }
  const current = history[history.length - 1]!;
  if (current.lifecycle === 'COMPROMISED' || current.lifecycle === 'DISABLED') {
    return candidateErr('SIGNING_DISABLED', 'compromised or disabled keys cannot rotate into new signing');
  }
  history[history.length - 1] = Object.freeze({ ...current, lifecycle: 'VERIFY_ONLY' });
  const next: CustodyKmsKeyVersion = Object.freeze({
    keyId,
    version: current.version + 1,
    lifecycle: 'ACTIVE',
    exportable: false,
  });
  history.push(next);
  return candidateOk(next);
}

export function markKmsCompromised(keyId: string): CustodyCandidateResult<CustodyKmsKeyVersion> {
  const history = versions.get(keyId);
  if (!history) {
    return candidateErr('UNKNOWN_KEY', 'KMS key is not registered');
  }
  const current = history[history.length - 1]!;
  const next = Object.freeze({ ...current, lifecycle: 'COMPROMISED' as const });
  history[history.length - 1] = next;
  return candidateOk(next);
}

export function activeSigningVersion(keyId: string): CustodyKmsKeyVersion | undefined {
  return versions.get(keyId)?.find((version) => version.lifecycle === 'ACTIVE');
}

export function historicalVersions(keyId: string): readonly CustodyKmsKeyVersion[] {
  return Object.freeze([...(versions.get(keyId) ?? [])]);
}

export function assertCustodyWorkerCannotUseGovernanceKms(): CustodyCandidateResult<true> {
  return assertWorkloadMayUseKey('custody_worker', 'GOVERNANCE_KMS');
}

export function resetKmsKeys(): void {
  versions.clear();
}
