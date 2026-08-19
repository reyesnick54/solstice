import { err, ok, type Result } from '../../domain/src/result.ts';
import type { AiRuntimeMode } from './taxonomy.ts';
import {
  EXTERNAL_ELIGIBLE_DATA_CLASSES,
  NEVER_RELEASE_DATA_CLASSES,
  isExternalProvider,
  type AiDataClass,
  type AiProviderKind,
} from './taxonomy.ts';
import type {
  AiContextAuthorization,
  AiContextObject,
  AiContextReleaseDecision,
  AiProviderFailure,
  AiRuntimePolicy,
} from './types.ts';

export function createDefaultAiRuntimePolicy(mode: AiRuntimeMode): AiRuntimePolicy {
  return Object.freeze({
    mode,
    allowLocalTestFallback: mode === 'S3M_PRIMARY' || mode === 'DUAL_SHADOW_COMPARE',
    storeRawPrompts: false,
    allowExternalWithoutUserApproval: false,
    allowPrivateKeyRelease: false,
    s3mUnavailableFallsBackToGrok: false,
    modelMayModifyPolicy: false,
    providerMaySelfSelect: false,
  });
}

export function externalProviderEligible(input: {
  readonly dataClass: AiDataClass;
  readonly authorization: AiContextAuthorization;
  readonly policy: AiRuntimePolicy;
}): boolean {
  if (!EXTERNAL_ELIGIBLE_DATA_CLASSES.has(input.dataClass)) {
    return false;
  }
  if (input.policy.allowExternalWithoutUserApproval !== false) {
    return false;
  }
  return input.authorization.userApprovedExternal === true;
}

export function evaluateContextRelease(input: {
  readonly objects: readonly AiContextObject[];
  readonly providerKind: AiProviderKind;
  readonly requestDataClass: AiDataClass;
  readonly authorization: AiContextAuthorization;
  readonly policy: AiRuntimePolicy;
}): Result<AiContextReleaseDecision, AiProviderFailure> {
  if (NEVER_RELEASE_DATA_CLASSES.has(input.requestDataClass)) {
    return err({
      ok: false,
      code: 'NEVER_RELEASE_DATA_CLASS',
      detail: `${input.requestDataClass} must never be sent to an AI provider`,
      providerKind: input.providerKind,
    });
  }
  if (
    isExternalProvider(input.providerKind) &&
    !externalProviderEligible({
      dataClass: input.requestDataClass,
      authorization: input.authorization,
      policy: input.policy,
    })
  ) {
    return err({
      ok: false,
      code: 'DATA_CLASS_BLOCKS_EXTERNAL',
      detail: 'external-provider eligibility is independent of task class and failed closed',
      providerKind: input.providerKind,
    });
  }

  const released: string[] = [];
  const denied: string[] = [];
  for (const object of input.objects) {
    if (NEVER_RELEASE_DATA_CLASSES.has(object.dataClass)) {
      return err({
        ok: false,
        code: 'NEVER_RELEASE_DATA_CLASS',
        detail: `context ${object.objectId} is ${object.dataClass} and cannot be released`,
        providerKind: input.providerKind,
      });
    }
    if (containsSecretMaterial(object.payload)) {
      return err({
        ok: false,
        code: 'SECRET_IN_PAYLOAD',
        detail: `context ${object.objectId} contains secret or key material`,
        providerKind: input.providerKind,
      });
    }
    const authorized =
      object.authorizedProviders.includes(input.providerKind) &&
      (object.dataClass !== 'USER_APPROVED_CONTEXT' || object.userApproved) &&
      !(isExternalProvider(input.providerKind) && !EXTERNAL_ELIGIBLE_DATA_CLASSES.has(object.dataClass));
    if (!authorized) {
      denied.push(object.objectId);
    } else {
      released.push(object.objectId);
    }
  }
  if (denied.length > 0) {
    return err({
      ok: false,
      code: 'CONTEXT_RELEASE_DENIED',
      detail: `restricted context cannot be released to ${input.providerKind}: ${denied.join(',')}`,
      providerKind: input.providerKind,
    });
  }
  return ok(
    Object.freeze({
      providerKind: input.providerKind,
      allowed: true,
      releasedObjectIds: Object.freeze([...released]),
      deniedObjectIds: Object.freeze([]),
      code: null,
      failClosed: true as const,
    }),
  );
}

export function containsSecretMaterial(payload: Readonly<Record<string, unknown>>): boolean {
  const blob = JSON.stringify(payload).toLowerCase();
  return (
    blob.includes('private_key') ||
    blob.includes('privatekey') ||
    blob.includes('master_key') ||
    blob.includes('masterkey') ||
    blob.includes('seed_phrase') ||
    blob.includes('mnemonic') ||
    blob.includes('api_key') ||
    blob.includes('apikey') ||
    blob.includes('authorization: bearer') ||
    blob.includes('password')
  );
}
