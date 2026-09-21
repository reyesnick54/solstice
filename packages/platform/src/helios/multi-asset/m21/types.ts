/**
 * HELIOS Multi-Asset M21 — Universal Execution Plan input contract.
 * Consumed by M22 order planning. Does not grant Execution Authority.
 */

import type { UtcInstant } from '@solstice/domain';
import type { DecisionValidityEnvelopeId } from '../../decision-validity/ids.ts';

export const UNIVERSAL_EXECUTION_PLAN_VERSION = 'helios-universal-execution-plan-v1' as const;

export const EXECUTION_PLAN_SIDES = ['BUY', 'SELL'] as const;
export type ExecutionPlanSide = (typeof EXECUTION_PLAN_SIDES)[number];

export const EXECUTION_PLAN_URGENCIES = [
  'PASSIVE',
  'NORMAL',
  'HIGH',
  'URGENT_EXIT',
] as const;
export type ExecutionPlanUrgency = (typeof EXECUTION_PLAN_URGENCIES)[number];

export const EXECUTION_STRATEGY_REQUIREMENTS = [
  'PASSIVE_ENTRY',
  'AGGRESSIVE_ENTRY',
  'PASSIVE_EXIT',
  'URGENT_EXIT',
  'TWAP',
  'VWAP',
  'PARTICIPATION_RATE',
  'MINIMIZE_IMPACT',
] as const;
export type ExecutionStrategyRequirement = (typeof EXECUTION_STRATEGY_REQUIREMENTS)[number];

/** Authorized plan produced upstream; M22 converts this into provider-neutral tactics. */
export type UniversalExecutionPlan = {
  readonly executionPlanId: string;
  readonly configVersion: typeof UNIVERSAL_EXECUTION_PLAN_VERSION;
  readonly envelopeId: DecisionValidityEnvelopeId;
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly side: ExecutionPlanSide;
  readonly totalQuantityUnits: bigint;
  readonly quantityScale: number;
  readonly currency: string;
  readonly urgency: ExecutionPlanUrgency;
  readonly strategyRequirements: readonly ExecutionStrategyRequirement[];
  readonly maxSlippageBps: number;
  readonly maxParticipationRateBps: number | null;
  readonly arrivalPriceMinor: bigint;
  readonly validFrom: UtcInstant;
  readonly validUntil: UtcInstant;
  readonly routeId: string;
  readonly providerId: string;
  readonly evidenceRefs: readonly string[];
  readonly grantsExecutionAuthority: false;
  readonly deterministic: true;
};
