import { err, ok, type Result } from '../../domain/src/result.ts';
import { containsSecretMaterial, evaluateContextRelease } from './policy.ts';
import {
  NEVER_RELEASE_DATA_CLASSES,
  NEVER_RELEASE_PRIVACY_CLASSES,
  privacyClassToDataClass,
  type AiDataClass,
  type AiPrivacyClass,
  type AiProviderKind,
} from './taxonomy.ts';
import type { AiContextAuthorization, AiContextObject, AiProviderFailure, AiRuntimePolicy } from './types.ts';

export const FORBIDDEN_CONTEXT_KEYS = Object.freeze([
  'kycDocument',
  'kyc_document',
  'passport',
  'ssn',
  'nationalId',
  'privateKey',
  'private_key',
  'seedPhrase',
  'mnemonic',
  'pan',
  'cvv',
  'cardNumber',
  'apiKey',
  'api_key',
  'password',
  'masterKey',
]);

export function assertPrivacyBoundary(input: {
  readonly privacyClass: AiPrivacyClass;
  readonly dataClass: AiDataClass;
  readonly providerKind: AiProviderKind;
  readonly objects: readonly AiContextObject[];
  readonly authorization: AiContextAuthorization;
  readonly policy: AiRuntimePolicy;
}): Result<true, AiProviderFailure> {
  if (NEVER_RELEASE_PRIVACY_CLASSES.has(input.privacyClass) || NEVER_RELEASE_DATA_CLASSES.has(input.dataClass)) {
    return err({
      ok: false,
      code: 'NEVER_RELEASE_DATA_CLASS',
      detail: `${input.privacyClass}/${input.dataClass} must never be sent to an AI provider`,
      providerKind: input.providerKind,
    });
  }
  for (const object of input.objects) {
    if (containsForbiddenContextKey(object.payload)) {
      return err({
        ok: false,
        code: 'SECRET_IN_PAYLOAD',
        detail: `context ${object.objectId} contains KYC, key, payment-credential, or secret fields`,
        providerKind: input.providerKind,
      });
    }
    if (containsSecretMaterial(object.payload)) {
      return err({
        ok: false,
        code: 'SECRET_IN_PAYLOAD',
        detail: `context ${object.objectId} contains secret material`,
        providerKind: input.providerKind,
      });
    }
  }
  const release = evaluateContextRelease({
    objects: input.objects,
    providerKind: input.providerKind,
    requestDataClass: input.dataClass,
    authorization: input.authorization,
    policy: input.policy,
  });
  return release.ok ? ok(true) : release;
}

export function containsForbiddenContextKey(payload: Readonly<Record<string, unknown>>): boolean {
  const keys = Object.keys(payload);
  return keys.some((key) => FORBIDDEN_CONTEXT_KEYS.includes(key));
}

export function modelMayReceivePrivacy(
  allowed: readonly AiPrivacyClass[],
  privacyClass: AiPrivacyClass,
): boolean {
  if (NEVER_RELEASE_PRIVACY_CLASSES.has(privacyClass)) {
    return false;
  }
  return allowed.includes(privacyClass);
}

export function expectedDataClass(privacyClass: AiPrivacyClass): AiDataClass {
  return privacyClassToDataClass(privacyClass);
}
