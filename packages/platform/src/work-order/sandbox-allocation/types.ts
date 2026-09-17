import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicMandateId, MandateVersion } from '../../ids.ts';
import type { WorkOrderMoney } from '../types.ts';
import type { EconomicWorkOrderId } from '../ids.ts';
import type { GrowSandboxAllocationId } from './ids.ts';
import type {
  GrowAllocationExecutionMode,
  GrowAllocationFailureCode,
  GrowAllocationStatus,
} from './taxonomy.ts';

export type GrowAllocationBalanceReference = {
  readonly accountId: string;
  readonly epoch: number;
  readonly asOf: UtcInstant;
  readonly ledgerBalanceMinorUnits: string;
  readonly settledMinorUnits: string;
  readonly heldMinorUnits: string;
  readonly availableMinorUnits: string;
};

export type GrowAllocationMandateRef = {
  readonly mandateId: EconomicMandateId;
  readonly mandateVersion: MandateVersion;
};

export type GrowAllocationControlRefs = {
  readonly approvalReference: string | null;
  readonly capabilityContextReference: string | null;
  readonly authorityDecisionReference: string | null;
};

export type GrowAllocationDecision = 'ALLOW' | 'REFUSE';

export type GrowSandboxAllocation = {
  readonly allocationId: GrowSandboxAllocationId;
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: string;
  readonly accountId: string;
  readonly currency: string;
  readonly environment: 'simulation';
  readonly executionMode: GrowAllocationExecutionMode;
  readonly requestedAmountMinorUnits: string;
  readonly acceptedAmountMinorUnits: string;
  readonly reservedAmountMinorUnits: string;
  readonly availableAtRequestMinorUnits: string;
  readonly status: GrowAllocationStatus;
  readonly mandateRef: GrowAllocationMandateRef;
  readonly controlRefs: GrowAllocationControlRefs;
  readonly balanceReference: GrowAllocationBalanceReference;
  readonly holdId: string | null;
  readonly reservationReference: string | null;
  readonly riskDecision: GrowAllocationDecision;
  readonly complianceDecision: GrowAllocationDecision;
  readonly refusalReason: string | null;
  readonly createdAt: UtcInstant;
  readonly updatedAt: UtcInstant;
  readonly version: number;
  readonly idempotencyKey: string;
  readonly createsFinancialAuthority: false;
  readonly postsLedger: false;
  readonly impliesLiveProvider: false;
};

export type GrowAllocationFailure = {
  readonly code: GrowAllocationFailureCode;
  readonly message: string;
};

export type RequestGrowSandboxAllocationInput = {
  readonly workOrderId: EconomicWorkOrderId;
  readonly customerId: string;
  readonly requestedAmount: WorkOrderMoney;
  readonly idempotencyKey: string;
  readonly executionMode: GrowAllocationExecutionMode;
};

export type ReleaseGrowSandboxAllocationInput = {
  readonly allocationId: GrowSandboxAllocationId;
  readonly customerId: string;
  readonly reason: string;
};
