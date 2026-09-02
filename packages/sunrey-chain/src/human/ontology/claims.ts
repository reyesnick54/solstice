/**
 * Wave 6 — HumanEconomicClaim specialization for CanonicalEconomicClaim.
 *
 * Extends the Wave 3 claim lattice without a second claim infrastructure.
 * Claims carry no supply mutation authority.
 */

import { buildHumanEconomicClaim } from '../../economic-proof/adapters.ts';
import type { CanonicalEconomicClaim } from '../../economic-proof/types.ts';
import { HUMAN_ONTOLOGY_INVARIANTS } from './constants.ts';
import { validateHumanContributionEventMaterial } from './controls.ts';
import type { HumanContributionEventMaterial } from './types.ts';

export const HUMAN_CLAIM_EXTENSION_SCHEMA = 'sunrey.human-economic-claim.v1' as const;

export type HumanEconomicClaimExtension = {
  readonly schema: typeof HUMAN_CLAIM_EXTENSION_SCHEMA;
  readonly humanActorId: string;
  readonly pseudonymousId: string;
  readonly governanceCategory: string;
  readonly contributionClass: string;
  readonly eventType: string;
  readonly eventRef: string;
  readonly eventKind: string;
  readonly quantity: bigint;
  readonly unit: string;
  readonly intervalStartUtc: string;
  readonly intervalEndUtc: string;
  readonly jurisdiction: string;
  readonly evidenceRefs: readonly string[];
  readonly attestationRefs: readonly string[];
  readonly consentRefs: readonly string[];
  readonly rightsRefs: readonly string[];
  readonly purposeRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
  readonly methodologyId: string;
  readonly uniquenessDigest: string;
  readonly informationConsensusReceiptRef: string | null;
  readonly invariants: typeof HUMAN_ONTOLOGY_INVARIANTS;
};

export type HumanEconomicClaimBundle = {
  readonly claim: CanonicalEconomicClaim;
  readonly extension: HumanEconomicClaimExtension;
};

export function buildHumanEconomicClaimBundle(input: {
  readonly economicClaimId: string;
  readonly canonicalEntityId: string;
  readonly canonicalEventId: string;
  readonly event: HumanContributionEventMaterial;
  readonly supportingFactIds: readonly string[];
  readonly informationConsensusReceiptRef?: string | null;
}): { readonly ok: true; readonly bundle: HumanEconomicClaimBundle } | { readonly ok: false; readonly code: string; readonly message: string } {
  const validated = validateHumanContributionEventMaterial(input.event);
  if (!validated.ok) {
    return { ok: false, code: validated.code, message: validated.message };
  }
  const event = validated.value;
  const claim = buildHumanEconomicClaim({
    economicClaimId: input.economicClaimId,
    canonicalEntityId: input.canonicalEntityId,
    canonicalEventId: input.canonicalEventId,
    subjectRef: event.pseudonymousId,
    supportingFactIds: input.supportingFactIds,
    evidenceRefs: event.evidenceRefs,
    temporalBounds: {
      startUtc: event.intervalStartUtc,
      endUtc: event.intervalEndUtc,
    },
  });
  const extension: HumanEconomicClaimExtension = Object.freeze({
    schema: HUMAN_CLAIM_EXTENSION_SCHEMA,
    humanActorId: event.humanActorId,
    pseudonymousId: event.pseudonymousId,
    governanceCategory: event.governanceCategory,
    contributionClass: event.contributionClass,
    eventType: event.eventType,
    eventRef: event.eventRef,
    eventKind: event.eventKind,
    quantity: event.quantity,
    unit: event.unit,
    intervalStartUtc: event.intervalStartUtc,
    intervalEndUtc: event.intervalEndUtc,
    jurisdiction: event.jurisdiction,
    evidenceRefs: Object.freeze([...event.evidenceRefs]),
    attestationRefs: Object.freeze([...event.attestationRefs]),
    consentRefs: Object.freeze([...event.consentRefs]),
    rightsRefs: Object.freeze([...event.rightsRefs]),
    purposeRefs: Object.freeze([...event.purposeRefs]),
    provenanceRefs: Object.freeze([...event.provenanceRefs]),
    methodologyId: event.methodologyId,
    uniquenessDigest: event.uniquenessDigest,
    informationConsensusReceiptRef: input.informationConsensusReceiptRef ?? null,
    invariants: HUMAN_ONTOLOGY_INVARIANTS,
  });
  return Object.freeze({
    ok: true,
    bundle: Object.freeze({ claim, extension }),
  });
}

export function humanClaimLacksSupplyAuthority(bundle: HumanEconomicClaimBundle): boolean {
  return (
    bundle.claim.authority.mintsNativeAsset === false &&
    bundle.claim.authority.issuesExecutionAuthority === false &&
    bundle.extension.invariants.CLAIM_IS_NOT_SUNREY === true &&
    bundle.extension.invariants.CONTRIBUTION_EVENT_CANNOT_DIRECTLY_MINT === true
  );
}
