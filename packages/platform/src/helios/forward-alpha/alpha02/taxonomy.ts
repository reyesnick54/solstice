export const HELIOS_FORWARD_ALPHA_ALPHA02_SCHEMA = 'sunrey.helios.forward-alpha.alpha02.v1' as const;

export const HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED =
  'HELIOS_ALPHA02_PREREGISTRATION_QUALIFIED' as const;

export const HELIOS_ALPHA02_PREREGISTRATION_BLOCKED = 'HELIOS_ALPHA02_PREREGISTRATION_BLOCKED' as const;

export const FORWARD_CAMPAIGN_LIFECYCLE_STATES = ['SEALED', 'ACTIVE', 'SUPERSEDED', 'COMPLETED'] as const;

export type ForwardCampaignLifecycleState = (typeof FORWARD_CAMPAIGN_LIFECYCLE_STATES)[number];

/** Predeclared adaptation rule kinds — manual threshold edits are never permitted after start. */
export const PERMITTED_ADAPTATION_RULE_KINDS = [
  'ONLINE_PARAMETER_UPDATE',
  'REGIME_WEIGHT_REBALANCE',
  'VOL_TARGET_RECALIBRATION',
] as const;

export type PermittedAdaptationRuleKind = (typeof PERMITTED_ADAPTATION_RULE_KINDS)[number];

export const FORBIDDEN_ADAPTATION_RULE_KINDS = ['MANUAL_THRESHOLD_OVERRIDE', 'HINDSIGHT_CONFIG_PATCH'] as const;

export type ForbiddenAdaptationRuleKind = (typeof FORBIDDEN_ADAPTATION_RULE_KINDS)[number];
