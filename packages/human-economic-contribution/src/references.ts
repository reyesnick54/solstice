import type { CanonicalContributionReferences } from './types.ts';

export const EMPTY_CANONICAL_REFERENCES: CanonicalContributionReferences = Object.freeze({
  informationRightRefs: Object.freeze([]),
  consentGrantRefs: Object.freeze([]),
  usageReceiptRefs: Object.freeze([]),
  cleanRoomResultRefs: Object.freeze([]),
  pegEventRefs: Object.freeze([]),
  ledgerEventRefs: Object.freeze([]),
  paymentEventRefs: Object.freeze([]),
  cardEventRefs: Object.freeze([]),
  externalAttestationRefs: Object.freeze([]),
  communityAttestationRefs: Object.freeze([]),
  researchAttestationRefs: Object.freeze([]),
  professionalAttestationRefs: Object.freeze([]),
});

export function mergeCanonicalReferences(
  partial: Partial<CanonicalContributionReferences> | undefined,
): CanonicalContributionReferences {
  return Object.freeze({
    informationRightRefs: Object.freeze([...(partial?.informationRightRefs ?? [])]),
    consentGrantRefs: Object.freeze([...(partial?.consentGrantRefs ?? [])]),
    usageReceiptRefs: Object.freeze([...(partial?.usageReceiptRefs ?? [])]),
    cleanRoomResultRefs: Object.freeze([...(partial?.cleanRoomResultRefs ?? [])]),
    pegEventRefs: Object.freeze([...(partial?.pegEventRefs ?? [])]),
    ledgerEventRefs: Object.freeze([...(partial?.ledgerEventRefs ?? [])]),
    paymentEventRefs: Object.freeze([...(partial?.paymentEventRefs ?? [])]),
    cardEventRefs: Object.freeze([...(partial?.cardEventRefs ?? [])]),
    externalAttestationRefs: Object.freeze([...(partial?.externalAttestationRefs ?? [])]),
    communityAttestationRefs: Object.freeze([...(partial?.communityAttestationRefs ?? [])]),
    researchAttestationRefs: Object.freeze([...(partial?.researchAttestationRefs ?? [])]),
    professionalAttestationRefs: Object.freeze([...(partial?.professionalAttestationRefs ?? [])]),
  });
}
