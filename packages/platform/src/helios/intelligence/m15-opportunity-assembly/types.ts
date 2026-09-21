import type { CustomerId, UtcInstant } from '@solstice/domain';
import type { EconomicWorkOrderId } from '../../ids.ts';
import type { StrategyFamilyId } from '../m13-regime/taxonomy.ts';

export const HELIOS_M15_OPPORTUNITY_ASSEMBLY_VERSION = 'HELIOS_M15_OPPORTUNITY_ASSEMBLY_V1' as const;

export type OpportunityCandidateSource =
  | 'STRATEGY_LAB_M09'
  | 'STRATEGY_LAB_M10'
  | 'COMMODITY_TREND'
  | 'RELATIVE_VALUE_STAT_ARB'
  | 'AGENTIC_CAPITAL_MESH'
  | 'GROK_RESEARCH';

export type AssembledOpportunityCandidate = {
  readonly opportunityId: string;
  readonly candidateId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: CustomerId;
  readonly subjectId: string;
  readonly source: OpportunityCandidateSource;
  readonly strategyFamily: StrategyFamilyId;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly instrumentIds: readonly string[];
  readonly assetClass: string;
  readonly sector: string;
  readonly evidenceRefs: readonly string[];
  readonly envelopeRef: string | null;
  readonly discoveredAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly authorizesFinancialExecution: false;
};

export type AssemblyRejection = {
  readonly opportunityId: string;
  readonly reason: string;
  readonly code: 'WORK_ORDER_INACTIVE' | 'MISSING_EVIDENCE' | 'EXPIRED' | 'ENVELOPE_INVALID' | 'DUPLICATE';
};

export type OpportunityAssemblyResult = {
  readonly assemblyId: string;
  readonly version: typeof HELIOS_M15_OPPORTUNITY_ASSEMBLY_VERSION;
  readonly workOrderId: EconomicWorkOrderId;
  readonly accepted: readonly AssembledOpportunityCandidate[];
  readonly rejected: readonly AssemblyRejection[];
  readonly assembledAt: UtcInstant;
};

export type OpportunityAssemblyInput = {
  readonly assemblyId: string;
  readonly workOrderId: EconomicWorkOrderId;
  readonly workOrderActive: boolean;
  readonly envelopeValidByOpportunityId: Readonly<Record<string, boolean>>;
  readonly candidates: readonly AssembledOpportunityCandidate[];
  readonly now: UtcInstant;
};
