import { sha256Canonical } from './ids.ts';
import type { AiApprovedPurpose, AiPrivacyClass } from './taxonomy.ts';

export const INFERENCE_CACHE_SCOPES = ['NONE', 'SCOPED_NON_PERSONAL'] as const;
export type InferenceCacheScope = (typeof INFERENCE_CACHE_SCOPES)[number];

export type InferenceCachePolicy = {
  readonly scope: InferenceCacheScope;
  readonly sharedAcrossUsers: false;
};

export const DEFAULT_AGENT_CACHE_POLICY: InferenceCachePolicy = Object.freeze({
  scope: 'NONE',
  sharedAcrossUsers: false,
});

export const NON_PERSONAL_CACHE_POLICY: InferenceCachePolicy = Object.freeze({
  scope: 'SCOPED_NON_PERSONAL',
  sharedAcrossUsers: false,
});

const CACHEABLE_PRIVACY = new Set<AiPrivacyClass>(['PUBLIC']);
const CACHEABLE_PURPOSES = new Set<AiApprovedPurpose>(['SIMPLE_CLASSIFICATION']);

export function resolveCachePolicy(input: {
  readonly privacyClass: AiPrivacyClass;
  readonly purpose: AiApprovedPurpose;
  readonly personalized: boolean;
}): InferenceCachePolicy {
  if (input.personalized) {
    return DEFAULT_AGENT_CACHE_POLICY;
  }
  if (CACHEABLE_PRIVACY.has(input.privacyClass) && CACHEABLE_PURPOSES.has(input.purpose)) {
    return NON_PERSONAL_CACHE_POLICY;
  }
  return DEFAULT_AGENT_CACHE_POLICY;
}

export type CachedInference = {
  readonly key: string;
  readonly text: string;
  readonly userId: string | null;
};

export class InferenceResponseCache {
  private readonly items = new Map<string, CachedInference>();

  get(input: {
    readonly policy: InferenceCachePolicy;
    readonly purpose: AiApprovedPurpose;
    readonly prompt: string;
    readonly userId: string;
  }): CachedInference | null {
    if (input.policy.scope === 'NONE') {
      return null;
    }
    return this.items.get(cacheKey(input.purpose, input.prompt, null)) ?? null;
  }

  set(input: {
    readonly policy: InferenceCachePolicy;
    readonly purpose: AiApprovedPurpose;
    readonly prompt: string;
    readonly userId: string;
    readonly text: string;
  }): boolean {
    if (input.policy.scope !== 'SCOPED_NON_PERSONAL' || input.policy.sharedAcrossUsers !== false) {
      return false;
    }
    const key = cacheKey(input.purpose, input.prompt, null);
    this.items.set(key, Object.freeze({ key, text: input.text, userId: null }));
    return true;
  }
}

function cacheKey(purpose: AiApprovedPurpose, prompt: string, userId: string | null): string {
  return sha256Canonical(`${purpose}:${userId ?? 'shared-non-personal'}:${prompt}`);
}
