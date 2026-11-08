/**
 * HELIOS Forward Alpha ALPHA02 — online learning only via predeclared adaptation rules.
 */

import type { UtcInstant } from '@solstice/domain';

export type AdaptationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AdaptationFailure };

function adaptationOk<T>(value: T): AdaptationResult<T> {
  return { ok: true, value };
}

function adaptationErr(error: AdaptationFailure): AdaptationResult<never> {
  return { ok: false, error };
}

import { assertCampaignConfigurationImmutable } from './immutability.ts';
import { digestRuleContent } from './fingerprint.ts';
import { FORBIDDEN_ADAPTATION_RULE_KINDS } from './taxonomy.ts';
import type { AdaptationEventRecord, ForwardCampaignRegistration, FrozenAdaptationRule } from './types.ts';

export type ProposeAdaptationInput = {
  readonly eventId: string;
  readonly recordedAt: UtcInstant;
  readonly ruleId: string;
  readonly parameterPath: string;
  readonly priorValue: unknown;
  readonly newValue: unknown;
  readonly triggerMaterial: unknown;
};

export type AdaptationFailure = {
  readonly code:
    | 'CAMPAIGN_NOT_ACTIVE'
    | 'ONLINE_LEARNING_DISABLED'
    | 'RULE_NOT_PREDECLARED'
    | 'PARAMETER_PATH_NOT_PERMITTED'
    | 'FORBIDDEN_RULE_KIND'
    | 'DUPLICATE_EVENT_ID';
  readonly message: string;
};

function findPredeclaredRule(
  registration: ForwardCampaignRegistration,
  ruleId: string,
): FrozenAdaptationRule | null {
  return registration.adaptationPolicy.permittedRules.find((r) => r.ruleId === ruleId) ?? null;
}

export function validateAdaptationPermitted(
  registration: ForwardCampaignRegistration,
  input: ProposeAdaptationInput,
): AdaptationResult<FrozenAdaptationRule> {
  if (registration.lifecycle.state !== 'ACTIVE') {
    return adaptationErr({
      code: 'CAMPAIGN_NOT_ACTIVE',
      message: 'Adaptation events are only permitted while campaign is ACTIVE',
    });
  }
  if (!registration.adaptationPolicy.onlineLearningPermitted) {
    return adaptationErr({
      code: 'ONLINE_LEARNING_DISABLED',
      message: 'Online learning was not predeclared for this campaign',
    });
  }
  if (registration.adaptationEvents.some((e) => e.eventId === input.eventId)) {
    return adaptationErr({
      code: 'DUPLICATE_EVENT_ID',
      message: `Adaptation event ${input.eventId} already recorded`,
    });
  }

  const rule = findPredeclaredRule(registration, input.ruleId);
  if (rule === null) {
    return adaptationErr({
      code: 'RULE_NOT_PREDECLARED',
      message: `Adaptation rule ${input.ruleId} was not predeclared at campaign seal`,
    });
  }

  if ((FORBIDDEN_ADAPTATION_RULE_KINDS as readonly string[]).includes(rule.kind)) {
    return adaptationErr({
      code: 'FORBIDDEN_RULE_KIND',
      message: `Adaptation rule kind ${rule.kind} is never permitted`,
    });
  }

  if (!rule.parameterPaths.includes(input.parameterPath)) {
    return adaptationErr({
      code: 'PARAMETER_PATH_NOT_PERMITTED',
      message: `Parameter path ${input.parameterPath} is outside predeclared adaptation scope`,
    });
  }

  return adaptationOk(rule);
}

export function recordAdaptationEvent(
  registration: ForwardCampaignRegistration,
  input: ProposeAdaptationInput,
): AdaptationResult<ForwardCampaignRegistration> {
  assertCampaignConfigurationImmutable(registration);

  const ruleResult = validateAdaptationPermitted(registration, input);
  if (!ruleResult.ok) {
    return ruleResult;
  }
  const rule = ruleResult.value;

  const triggerDigest = digestRuleContent(input.triggerMaterial);
  const event: AdaptationEventRecord = Object.freeze({
    eventId: input.eventId,
    recordedAt: input.recordedAt,
    ruleId: rule.ruleId,
    ruleKind: rule.kind,
    parameterPath: input.parameterPath,
    priorValueDigest: digestRuleContent(input.priorValue),
    newValueDigest: digestRuleContent(input.newValue),
    triggerDigest,
  });

  return adaptationOk(
    Object.freeze({
      ...registration,
      adaptationEvents: Object.freeze([...registration.adaptationEvents, event]),
    }),
  );
}
