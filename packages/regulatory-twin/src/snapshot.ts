import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '../../domain/src/time.ts';
import { hashCanonical } from '../../kernel/src/policy/hash.ts';
import type { PolicyRegistry } from '../../kernel/src/policy/index.ts';
import { asRegulatorySnapshotId, type RegulatoryTwinId } from './ids.ts';
import type { RegulatorySnapshot } from './types.ts';

export function captureRegulatorySnapshot(input: {
  readonly twinId: RegulatoryTwinId;
  readonly registry: PolicyRegistry;
  readonly capturedAt: UtcInstant;
  readonly effectiveAt: UtcInstant;
}): RegulatorySnapshot {
  const state = input.registry.snapshot();
  const packRefs = state.versions.map((version) =>
    Object.freeze({
      packId: version.packId,
      versionId: version.versionId,
      version: version.version,
      contentHash: version.contentHash,
      lifecycle: version.lifecycle,
      legalReviewStatus: version.legalReviewStatus,
      screeningRequirementsHash: version.screeningRequirements
        ? hashCanonical(version.screeningRequirements)
        : null,
    }),
  );
  const legalEntityCapabilityRefs = state.capabilities.map((capability) =>
    Object.freeze({
      capabilityId: capability.capabilityId,
      legalEntityId: capability.legalEntityId,
      enabled: capability.enabled,
      environment: capability.environment,
      legalReviewStatus: capability.legalReviewStatus,
    }),
  );
  const productCapabilityRefs = state.products.map((product) =>
    Object.freeze({
      productId: product.productId,
      servingLegalEntityId: product.servingLegalEntityId,
      offeringMode: product.offeringMode,
      requiredCapabilityId: product.requiredCapabilityId,
    }),
  );
  const body = {
    packRefs,
    sourceRefs: state.sources,
    legalEntityCapabilityRefs,
    productCapabilityRefs,
    effectiveAt: input.effectiveAt,
    environment: 'simulation' as const,
  };
  return Object.freeze({
    snapshotId: asRegulatorySnapshotId(`rsn_${randomUUID().replaceAll('-', '')}`),
    twinId: input.twinId,
    capturedAt: input.capturedAt,
    effectiveAt: input.effectiveAt,
    environment: 'simulation',
    packRefs: Object.freeze(packRefs),
    sourceRefs: Object.freeze([...state.sources]),
    legalEntityCapabilityRefs: Object.freeze(legalEntityCapabilityRefs),
    productCapabilityRefs: Object.freeze(productCapabilityRefs),
    contentHash: hashCanonical(body),
    simulationOnly: true,
  });
}
