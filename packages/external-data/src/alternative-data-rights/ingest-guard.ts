/**
 * HELIOS ALT02 — new-ingestion firewall for alternative-data plane.
 */

import {
  blockedMissingAlternativeDataManifest,
  createAlternativeDataRightsRegistry,
  evaluateAlternativeDataGate,
  type AlternativeDataRightsRegistry,
  type PermittedPurpose,
} from '@solstice/provider-sdk';
import type { UtcInstant } from '@solstice/domain';

import {
  ARBEITNOW_ALT02_MANIFEST,
  ARBEITNOW_ALT02_REVOCATION_ACTIVE,
  ARBEITNOW_ALT02_REVOCATION_EXPIRED,
} from './fixtures.ts';

export type AlternativeDataIngestGuard = {
  readonly registry: AlternativeDataRightsRegistry;
  guardNewIngestion(input: {
    readonly providerId: string;
    readonly sourceId: string;
    readonly purpose: PermittedPurpose;
    readonly atUtc: UtcInstant;
  }): ReturnType<typeof evaluateAlternativeDataGate>;
};

export function createDefaultAlternativeDataIngestGuard(): AlternativeDataIngestGuard {
  const registry = createAlternativeDataRightsRegistry();
  registry.register({
    manifest: ARBEITNOW_ALT02_MANIFEST,
    revocation: ARBEITNOW_ALT02_REVOCATION_ACTIVE,
    grantsExecutionAuthority: false,
  });
  return createAlternativeDataIngestGuard(registry);
}

export function createAlternativeDataIngestGuard(registry: AlternativeDataRightsRegistry): AlternativeDataIngestGuard {
  function guardNewIngestion(input: {
    readonly providerId: string;
    readonly sourceId: string;
    readonly purpose: PermittedPurpose;
    readonly atUtc: UtcInstant;
  }) {
    const entry = registry.get(input.providerId, input.sourceId);
    if (!entry) {
      return blockedMissingAlternativeDataManifest({
        providerId: input.providerId,
        sourceId: input.sourceId,
        requestedPurpose: input.purpose,
      });
    }
    return evaluateAlternativeDataGate({
      manifest: entry.manifest,
      revocation: entry.revocation,
      requestedPurpose: input.purpose,
      accessMode: 'new_ingestion',
      atUtc: input.atUtc,
    });
  }

  return Object.freeze({ registry, guardNewIngestion });
}

export { ARBEITNOW_ALT02_REVOCATION_EXPIRED };
