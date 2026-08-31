/**
 * ACCESS Wave 2 — Canonical Access domain types for provider integration.
 *
 * Provider adapters map external models into these types. External models must
 * not leak beyond adapter boundaries.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { AccessProviderId, CanonicalCapacityUnit, ProviderRightKind } from '../types.ts';
import type { ProviderCostMetadata } from './cost-model.ts';

export type AccessProduct = {
  readonly productId: string;
  readonly providerId: AccessProviderId;
  readonly category: AccessCapacityCategory;
  readonly canonicalUnit: CanonicalCapacityUnit;
  readonly title: string;
  readonly description: string;
  readonly location: string | null;
  readonly serviceClass: string | null;
  readonly rightKind: ProviderRightKind;
  readonly geography: string | null;
  readonly metadata: Readonly<Record<string, string>>;
};

export type AccessOpportunity = {
  readonly opportunityId: string;
  readonly providerId: AccessProviderId;
  readonly product: AccessProduct;
  readonly availableQuantity: bigint;
  readonly earliestStart: string | null;
  readonly latestEnd: string | null;
  readonly cost: ProviderCostMetadata | null;
  readonly simulationOnly: boolean;
  readonly sandboxOnly?: true;
  readonly discoveredAt: string;
};

export type AccessCapacity = {
  readonly capacityId: string;
  readonly providerId: AccessProviderId;
  readonly category: AccessCapacityCategory;
  readonly productId: string;
  readonly geography: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly units: bigint;
  readonly unit: CanonicalCapacityUnit;
  readonly approvedAt: string;
  readonly evidenceId: string | null;
  readonly simulationOnly: boolean;
};

export type AccessCapacityCandidate = {
  readonly candidateId: string;
  readonly providerId: AccessProviderId;
  readonly category: AccessCapacityCategory;
  readonly productId: string;
  readonly geography: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly units: bigint;
  readonly unit: CanonicalCapacityUnit;
  readonly retailValueMinorUnits: bigint | null;
  readonly providerCostMinorUnits: bigint | null;
  readonly currency: string | null;
  readonly settlementPreference: string | null;
  readonly evidenceId: string | null;
  readonly termsRef: string | null;
  readonly submittedAt: string;
  readonly state: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly simulationOnly: boolean;
};
