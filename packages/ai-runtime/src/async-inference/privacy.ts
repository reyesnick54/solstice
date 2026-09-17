import type { AiPrivacyClass, AiProviderKind } from '../taxonomy.ts';
import type { InferenceExternalPrivacyClass } from './taxonomy.ts';

const EXTERNAL_PROVIDER_ALLOWED = {
  S3M: ['PUBLIC', 'SUNREY_INTERNAL', 'CUSTOMER_PRIVATE'],
  XAI_GROK: ['PUBLIC'],
  LOCAL_TEST: ['PUBLIC', 'SUNREY_INTERNAL', 'CUSTOMER_PRIVATE', 'RESTRICTED_SENSITIVE'],
  HTTPS_GENERIC: ['PUBLIC'],
} as const satisfies Readonly<Record<AiProviderKind, readonly InferenceExternalPrivacyClass[]>>;

export function mapPrivacyClassToExternal(
  privacyClass: AiPrivacyClass,
): InferenceExternalPrivacyClass {
  switch (privacyClass) {
    case 'PUBLIC':
      return 'PUBLIC';
    case 'INTERNAL':
      return 'SUNREY_INTERNAL';
    case 'PERSONAL':
    case 'FINANCIAL_SENSITIVE':
      return 'CUSTOMER_PRIVATE';
    case 'REGULATED_IDENTITY':
    case 'SECRET':
      return 'PROVIDER_PROHIBITED';
    default: {
      const _exhaustive: never = privacyClass;
      return _exhaustive;
    }
  }
}

export function providerAcceptsPrivacyClassification(input: {
  readonly provider: AiProviderKind;
  readonly classification: InferenceExternalPrivacyClass;
}): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (input.classification === 'PROVIDER_PROHIBITED' || input.classification === 'RESTRICTED_SENSITIVE') {
    return { ok: false, reason: `${input.classification} must not leave SunRey for external inference` };
  }
  const allowed = EXTERNAL_PROVIDER_ALLOWED[input.provider] as readonly InferenceExternalPrivacyClass[];
  if (!allowed.includes(input.classification)) {
    return {
      ok: false,
      reason: `provider ${input.provider} does not accept ${input.classification} context`,
    };
  }
  return { ok: true };
}

export function externalPrivacyForGateway(input: {
  readonly privacyClass: AiPrivacyClass;
  readonly provider: AiProviderKind;
}): { readonly ok: true; readonly classification: InferenceExternalPrivacyClass } | { readonly ok: false; readonly reason: string } {
  const classification = mapPrivacyClassToExternal(input.privacyClass);
  const accepted = providerAcceptsPrivacyClassification({ provider: input.provider, classification });
  if (!accepted.ok) {
    return { ok: false, reason: accepted.reason };
  }
  return { ok: true, classification };
}
