/**
 * Wave 5 — ProductiveEconomicClaim specialization for CanonicalEconomicClaim.
 *
 * Extends the Wave 3 claim lattice without a second claim infrastructure.
 * Claims carry no supply mutation authority.
 */

import type { CanonicalEconomicClaim } from '../../economic-proof/types.ts';
import { buildProductiveEconomicClaim } from '../../economic-proof/adapters.ts';
import type { ProductiveEventMaterial } from './types.ts';
import { validateProductiveEventMaterial } from './controls.ts';
import { PRODUCTIVE_ONTOLOGY_INVARIANTS } from './constants.ts';

export const PRODUCTIVE_CLAIM_EXTENSION_SCHEMA = 'sunrey.productive-economic-claim.v1' as const;

export type ProductiveEconomicClaimExtension = {
  readonly schema: typeof PRODUCTIVE_CLAIM_EXTENSION_SCHEMA;
  readonly productiveEntityRef: string;
  readonly productiveEntityClass: string;
  readonly productiveEventType: string;
  readonly metric: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly intervalStartUtc: string;
  readonly intervalEndUtc: string;
  readonly jurisdiction: string;
  readonly region: string | null;
  readonly observationIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly rightsRef: string | null;
  readonly licenseRef: string | null;
  readonly corroborationReceiptRef: string | null;
  readonly informationConsensusReceiptRef: string | null;
  readonly productiveMethodologyId: string;
  readonly measurementKind: 'FLOW';
  readonly derivationClass: string;
  readonly invariants: typeof PRODUCTIVE_ONTOLOGY_INVARIANTS;
};

export type ProductiveEconomicClaimBundle = {
  readonly claim: CanonicalEconomicClaim;
  readonly extension: ProductiveEconomicClaimExtension;
};

export function buildProductiveEconomicClaimBundle(input: {
  readonly economicClaimId: string;
  readonly canonicalEntityId: string;
  readonly canonicalEventId: string;
  readonly event: ProductiveEventMaterial;
  readonly supportingFactIds: readonly string[];
  readonly evidenceRefs: readonly string[];
}): { readonly ok: true; readonly bundle: ProductiveEconomicClaimBundle } | { readonly ok: false; readonly code: string; readonly message: string } {
  const validated = validateProductiveEventMaterial(input.event);
  if (!validated.ok) {
    return { ok: false, code: validated.code, message: validated.message };
  }
  const event = validated.value;
  const claim = buildProductiveEconomicClaim({
    economicClaimId: input.economicClaimId,
    canonicalEntityId: input.canonicalEntityId,
    canonicalEventId: input.canonicalEventId,
    subjectRef: event.entityRef,
    resourceRef: event.entityRef,
    supportingFactIds: input.supportingFactIds,
    evidenceRefs: input.evidenceRefs.length > 0 ? input.evidenceRefs : [...event.evidenceRefs],
    temporalBounds: {
      startUtc: event.intervalStartUtc,
      endUtc: event.intervalEndUtc,
    },
  });
  const extension: ProductiveEconomicClaimExtension = Object.freeze({
    schema: PRODUCTIVE_CLAIM_EXTENSION_SCHEMA,
    productiveEntityRef: event.entityRef,
    productiveEntityClass: event.entityClass,
    productiveEventType: event.eventType,
    metric: event.metric,
    quantity: event.quantity,
    unit: event.unit,
    intervalStartUtc: event.intervalStartUtc,
    intervalEndUtc: event.intervalEndUtc,
    jurisdiction: event.jurisdiction,
    region: event.region,
    observationIds: Object.freeze([...event.observationIds]),
    evidenceRefs: Object.freeze([...input.evidenceRefs, ...event.evidenceRefs]),
    rightsRef: event.rightsRef,
    licenseRef: event.licenseRef,
    corroborationReceiptRef: event.consensusReceiptRef,
    informationConsensusReceiptRef: event.consensusReceiptRef,
    productiveMethodologyId: event.methodologyId,
    measurementKind: 'FLOW',
    derivationClass: event.derivationClass,
    invariants: PRODUCTIVE_ONTOLOGY_INVARIANTS,
  });
  return Object.freeze({
    ok: true,
    bundle: Object.freeze({ claim, extension }),
  });
}

export function productiveClaimLacksSupplyAuthority(bundle: ProductiveEconomicClaimBundle): boolean {
  return (
    bundle.claim.authority.mintsNativeAsset === false &&
    bundle.claim.authority.issuesExecutionAuthority === false &&
    bundle.extension.invariants.OBSERVATION_CANNOT_MINT === true
  );
}
