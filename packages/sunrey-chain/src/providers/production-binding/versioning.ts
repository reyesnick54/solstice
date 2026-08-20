import { bindingErr, bindingOk, type BindingResult, type BindingVersionPins } from './types.ts';

export function detectVersionDrift(
  pinned: BindingVersionPins,
  observed: BindingVersionPins,
): BindingResult<true> {
  const mismatches: string[] = [];
  if (pinned.adapterVersion !== observed.adapterVersion) {
    mismatches.push('adapterVersion');
  }
  if (pinned.schemaVersion !== observed.schemaVersion) {
    mismatches.push('schemaVersion');
  }
  if (pinned.translationVersion !== observed.translationVersion) {
    mismatches.push('translationVersion');
  }
  if (pinned.endpointProfileVersion !== observed.endpointProfileVersion) {
    mismatches.push('endpointProfileVersion');
  }
  if (pinned.credentialPolicyVersion !== observed.credentialPolicyVersion) {
    mismatches.push('credentialPolicyVersion');
  }
  if (pinned.conformanceSuiteVersion !== observed.conformanceSuiteVersion) {
    mismatches.push('conformanceSuiteVersion');
  }
  if (mismatches.length > 0) {
    return bindingErr(
      'SCHEMA_DRIFT_REQUIRES_REVALIDATION',
      `unexpected version drift requires revalidation: ${mismatches.join(',')}`,
    );
  }
  return bindingOk(true);
}

export function rotateCredentialVersionRef(current: string, nextVersion: number): string {
  const stripped = current.replace(/:v\d+$/, '');
  return `${stripped}:v${nextVersion}`;
}
