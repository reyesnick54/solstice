/**
 * HELIOS ALT02 — alternative-data rights firewall service (AAF entitlement extension).
 */

import {
  evaluateAlternativeDataFeatureGate,
  evaluateAlternativeDataGate,
  type AlternativeDataRightsRegistry,
  type PermittedPurpose,
} from '@solstice/provider-sdk';
import type { EvidenceVault } from '@solstice/evidence';
import type { UtcInstant } from '@solstice/domain';

import { sealAlt02GateEvidence } from './evidence.ts';

export type Alt02FirewallService = {
  guardIngestion(input: {
    readonly providerId: string;
    readonly sourceId: string;
    readonly purpose: PermittedPurpose;
    readonly atUtc: UtcInstant;
  }): ReturnType<typeof evaluateAlternativeDataGate>;
  guardFeature(input: {
    readonly providerId: string;
    readonly sourceId: string;
    readonly purpose: PermittedPurpose;
    readonly atUtc: UtcInstant;
  }): ReturnType<typeof evaluateAlternativeDataFeatureGate>;
};

export function createAlt02FirewallService(input: {
  readonly registry: AlternativeDataRightsRegistry;
  readonly evidenceVault?: EvidenceVault;
}): Alt02FirewallService {
  function resolve(providerId: string, sourceId: string) {
    return input.registry.get(providerId, sourceId);
  }

  function guardIngestion(args: {
    readonly providerId: string;
    readonly sourceId: string;
    readonly purpose: PermittedPurpose;
    readonly atUtc: UtcInstant;
  }) {
    const entry = resolve(args.providerId, args.sourceId);
    if (!entry) {
      const decision = Object.freeze({
        allowed: false,
        outcome: 'LICENSE_UNKNOWN' as const,
        requestedPurpose: args.purpose,
        providerId: args.providerId,
        sourceId: args.sourceId,
        message: 'missing rights manifest',
        grantsExecutionAuthority: false as const,
      });
      sealAlt02GateEvidence(input.evidenceVault, decision, { accessMode: 'new_ingestion' });
      return decision;
    }
    const decision = evaluateAlternativeDataGate({
      manifest: entry.manifest,
      revocation: entry.revocation,
      requestedPurpose: args.purpose,
      accessMode: 'new_ingestion',
      atUtc: args.atUtc,
    });
    if (!decision.allowed) {
      sealAlt02GateEvidence(input.evidenceVault, decision, { accessMode: 'new_ingestion' });
    }
    return decision;
  }

  function guardFeature(args: {
    readonly providerId: string;
    readonly sourceId: string;
    readonly purpose: PermittedPurpose;
    readonly atUtc: UtcInstant;
  }) {
    const entry = resolve(args.providerId, args.sourceId);
    if (!entry) {
      const decision = Object.freeze({
        allowed: false,
        outcome: 'LICENSE_UNKNOWN' as const,
        requestedPurpose: args.purpose,
        providerId: args.providerId,
        sourceId: args.sourceId,
        message: 'missing rights manifest',
        grantsExecutionAuthority: false as const,
      });
      sealAlt02GateEvidence(input.evidenceVault, decision, { accessMode: 'derived_feature' });
      return decision;
    }
    const decision = evaluateAlternativeDataFeatureGate({
      manifest: entry.manifest,
      revocation: entry.revocation,
      requestedPurpose: args.purpose,
      atUtc: args.atUtc,
    });
    if (!decision.allowed) {
      sealAlt02GateEvidence(input.evidenceVault, decision, { accessMode: 'derived_feature' });
    }
    return decision;
  }

  return Object.freeze({ guardIngestion, guardFeature });
}
