/**
 * Continuity, residency, privacy, replacement, and dual-provider
 * concentration. Claims preserve their evidence source. Residency
 * does not make a legal conclusion.
 */

import type {
  ProviderConcentrationReport,
  ProviderContinuityProfile,
  ProviderDataClass,
  ProviderDataResidencyProfile,
  ProviderDomain,
  ProviderReplacementPlan,
} from './types.ts';
import { profileFor } from './profiles.ts';

export function continuityProfile(input: {
  readonly providerId: string;
  readonly rtoTargetMs?: number | null;
  readonly rpoTargetMs?: number | null;
  readonly backupRecoveryCapability: boolean;
  readonly regionalFailover: boolean;
  readonly dependencyChain: readonly string[];
  readonly tested: boolean;
  readonly claimSource: string;
}): ProviderContinuityProfile {
  return Object.freeze({
    providerId: input.providerId,
    rtoTargetMs: input.rtoTargetMs ?? null,
    rpoTargetMs: input.rpoTargetMs ?? null,
    backupRecoveryCapability: input.backupRecoveryCapability,
    regionalFailover: input.regionalFailover,
    dependencyChain: Object.freeze([...input.dependencyChain]),
    tested: input.tested,
    claimSource: input.claimSource,
    engineeringClaimOnly: true,
  });
}

export function residencyProfile(input: {
  readonly providerId: string;
  readonly deploymentRegions: readonly string[];
  readonly configuredResidencyConstraints: readonly string[];
  readonly jurisdictionalReviewEvidenceId?: string | null;
}): ProviderDataResidencyProfile {
  return Object.freeze({
    providerId: input.providerId,
    deploymentRegions: Object.freeze([...input.deploymentRegions]),
    configuredResidencyConstraints: Object.freeze([...input.configuredResidencyConstraints]),
    legalConclusion: false,
    jurisdictionalReviewEvidenceId: input.jurisdictionalReviewEvidenceId ?? null,
  });
}

export function dataClassesFor(domain: ProviderDomain): readonly ProviderDataClass[] {
  return profileFor(domain).dataClasses;
}

export function planProviderReplacement(input: {
  readonly fromProviderId: string;
  readonly toProviderId: string;
  readonly domain: ProviderDomain;
  readonly compatibleCapabilities: boolean;
}): ProviderReplacementPlan {
  return Object.freeze({
    fromProviderId: input.fromProviderId,
    toProviderId: input.toProviderId,
    domain: input.domain,
    compatible: input.compatibleCapabilities,
    canonicalProtocolAuthorityUnchanged: true,
    evidenceRequired: profileFor(input.domain).requiredEvidenceClasses,
    governed: true,
  });
}

export function measureConcentration(input: {
  readonly providerIds: readonly string[];
  readonly regions: readonly string[];
  readonly controllers: readonly string[];
}): ProviderConcentrationReport {
  const uniqueProviders = new Set(input.providerIds).size;
  const uniqueRegions = new Set(input.regions).size;
  const uniqueControllers = new Set(input.controllers).size;
  const providerConcentration = input.providerIds.length === 0 ? 1 : uniqueProviders / input.providerIds.length;
  const regionConcentration = input.regions.length === 0 ? 1 : uniqueRegions / input.regions.length;
  const controllerConcentration = input.controllers.length === 0 ? 1 : uniqueControllers / input.controllers.length;
  return Object.freeze({
    providerConcentration,
    regionConcentration,
    controllerConcentration,
    dualProviderConfigured: uniqueProviders >= 2,
  });
}
