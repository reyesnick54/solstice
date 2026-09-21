import { asStrategyCapsuleId, asStrategyFamilyId } from '../capsule/ids.ts';

export const HELIOS_M12_RULE_ID = 'HELIOS_M12_RELATIVE_VALUE_STAT_ARB_V1' as const;
export const HELIOS_M12_RULE_VERSION = 'v1' as const;
export const HELIOS_M12_FAMILY_ID = asStrategyFamilyId('sfam_helios_m12_relative_value_stat_arb');
export const HELIOS_M12_CAPSULE_ID = asStrategyCapsuleId('scap_helios_m12_relative_value_stat_arb_v1');

export const HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED =
  'HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_BLOCKED =
  'HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_BLOCKED' as const;

/** Fixed-point scale for spread z-score (100 = 1.00σ). */
export const M12_Z_SCORE_SCALE = 100n;

/** Fixed-point scale for correlation (10000 = 1.0000). */
export const M12_CORRELATION_SCALE = 10_000n;
