/**
 * HELIOS Valuation Intelligence VAL07 — Residual income / economic profit taxonomy.
 */

export const VAL07_RESIDUAL_INCOME_MODULE = 'VAL07_RESIDUAL_INCOME' as const;

export const VAL07_RESIDUAL_INCOME_SCHEMA = 'helios.valuation-intelligence.val07-residual-income.v1' as const;

export const HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED =
  'HELIOS_VAL07_RESIDUAL_INCOME_QUALIFIED' as const;

export const HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED = 'HELIOS_VAL07_RESIDUAL_INCOME_BLOCKED' as const;

export const VAL07_RATE_BPS_SCALE = 10_000 as const;

export const RESIDUAL_INCOME_STAGE_KINDS = [
  'SINGLE_STAGE',
  'TWO_STAGE',
  'MULTI_STAGE',
  'EXPLICIT_PLUS_CONTINUING',
] as const;

export type ResidualIncomeStageKind = (typeof RESIDUAL_INCOME_STAGE_KINDS)[number];

export const ECONOMIC_VALUE_CREATION_LABELS = [
  'VALUE_CREATING',
  'VALUE_NEUTRAL',
  'VALUE_DESTROYING',
  'UNCERTAIN',
] as const;

export type EconomicValueCreationLabel = (typeof ECONOMIC_VALUE_CREATION_LABELS)[number];

export const RESIDUAL_CASH_FLOW_RESEARCH_DISCLAIMER =
  'EXPERIMENTAL_RESEARCH_MODEL_NOT_EMPIRICALLY_PROVEN_BY_HELIOS' as const;
