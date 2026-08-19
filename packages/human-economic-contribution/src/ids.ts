import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type ContributionId = Brand<string, 'ContributionId'>;
export type SubjectRef = Brand<string, 'SubjectRef'>;
export type EventReference = Brand<string, 'EventReference'>;
export type EvidenceRef = Brand<string, 'EvidenceRef'>;
export type InformationRightRef = Brand<string, 'InformationRightRef'>;
export type ConsentGrantRef = Brand<string, 'ConsentGrantRef'>;
export type PurposeRef = Brand<string, 'PurposeRef'>;
export type ProvenanceRef = Brand<string, 'ProvenanceRef'>;
export type AttestationRef = Brand<string, 'AttestationRef'>;
export type UsageReceiptRef = Brand<string, 'UsageReceiptRef'>;
export type CleanRoomResultRef = Brand<string, 'CleanRoomResultRef'>;
export type PegEventRef = Brand<string, 'PegEventRef'>;
export type LedgerEventRef = Brand<string, 'LedgerEventRef'>;
export type PaymentEventRef = Brand<string, 'PaymentEventRef'>;
export type CardEventRef = Brand<string, 'CardEventRef'>;
export type ExternalAttestationRef = Brand<string, 'ExternalAttestationRef'>;
export type CommunityAttestationRef = Brand<string, 'CommunityAttestationRef'>;
export type ResearchAttestationRef = Brand<string, 'ResearchAttestationRef'>;
export type ProfessionalAttestationRef = Brand<string, 'ProfessionalAttestationRef'>;
export type PolicyDecisionRef = Brand<string, 'PolicyDecisionRef'>;
export type TaxonomyVersion = Brand<string, 'TaxonomyVersion'>;

export const CONTRIBUTION_ID_PREFIXES = Object.freeze({
  contribution: 'hec_',
  subject: 'subj_',
  event: 'hevt_',
  evidence: 'hevr_',
  informationRight: 'hir_',
  consent: 'cgr_',
  purpose: 'pur_',
  provenance: 'prv_',
  attestation: 'att_',
  usageReceipt: 'urc_',
  cleanRoomResult: 'crrf_',
  pegEvent: 'peg_',
  ledgerEvent: 'led_',
  paymentEvent: 'pay_',
  cardEvent: 'card_',
  externalAttestation: 'extatt_',
  communityAttestation: 'comatt_',
  researchAttestation: 'resatt_',
  professionalAttestation: 'proatt_',
  policy: 'pol_',
});

const HEX_BODY = /^[a-f0-9]{16,64}$/;

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

function asPrefixedHex<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix)) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  const body = value.slice(prefix.length);
  if (!HEX_BODY.test(body)) {
    throw new TypeError(`${label} must be ${prefix} followed by 16-64 lowercase hex characters`);
  }
  return brandAs<string, T>(value);
}

export function asContributionId(value: string): ContributionId {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.contribution, 'ContributionId');
}
export function asSubjectRef(value: string): SubjectRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.subject, 'SubjectRef');
}
export function asEventReference(value: string): EventReference {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.event, 'EventReference');
}
export function asEvidenceRef(value: string): EvidenceRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.evidence, 'EvidenceRef');
}
export function asInformationRightRef(value: string): InformationRightRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.informationRight, 'InformationRightRef');
}
export function asConsentGrantRef(value: string): ConsentGrantRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.consent, 'ConsentGrantRef');
}
export function asPurposeRef(value: string): PurposeRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.purpose, 'PurposeRef');
}
export function asProvenanceRef(value: string): ProvenanceRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.provenance, 'ProvenanceRef');
}
export function asAttestationRef(value: string): AttestationRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.attestation, 'AttestationRef');
}
export function asUsageReceiptRef(value: string): UsageReceiptRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.usageReceipt, 'UsageReceiptRef');
}
export function asCleanRoomResultRef(value: string): CleanRoomResultRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.cleanRoomResult, 'CleanRoomResultRef');
}
export function asPegEventRef(value: string): PegEventRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.pegEvent, 'PegEventRef');
}
export function asLedgerEventRef(value: string): LedgerEventRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.ledgerEvent, 'LedgerEventRef');
}
export function asPaymentEventRef(value: string): PaymentEventRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.paymentEvent, 'PaymentEventRef');
}
export function asCardEventRef(value: string): CardEventRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.cardEvent, 'CardEventRef');
}
export function asExternalAttestationRef(value: string): ExternalAttestationRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.externalAttestation, 'ExternalAttestationRef');
}
export function asCommunityAttestationRef(value: string): CommunityAttestationRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.communityAttestation, 'CommunityAttestationRef');
}
export function asResearchAttestationRef(value: string): ResearchAttestationRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.researchAttestation, 'ResearchAttestationRef');
}
export function asProfessionalAttestationRef(value: string): ProfessionalAttestationRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.professionalAttestation, 'ProfessionalAttestationRef');
}
export function asPolicyDecisionRef(value: string): PolicyDecisionRef {
  return asPrefixedHex(value, CONTRIBUTION_ID_PREFIXES.policy, 'PolicyDecisionRef');
}
export function asTaxonomyVersion(value: string): TaxonomyVersion {
  if (!/^[0-9]+$/.test(value)) {
    throw new TypeError('TaxonomyVersion must be a decimal integer string');
  }
  return brandAs<string, 'TaxonomyVersion'>(value);
}

export function contributionIdFor(seed: string): ContributionId {
  return asContributionId(`${CONTRIBUTION_ID_PREFIXES.contribution}${digest(`contribution:${seed}`).slice(0, 32)}`);
}

export function subjectRefFor(seed: string): SubjectRef {
  return asSubjectRef(`${CONTRIBUTION_ID_PREFIXES.subject}${digest(`subject:${seed}`).slice(0, 32)}`);
}

export function eventReferenceFor(seed: string): EventReference {
  return asEventReference(`${CONTRIBUTION_ID_PREFIXES.event}${digest(`event:${seed}`).slice(0, 32)}`);
}

export function evidenceRefFor(seed: string): EvidenceRef {
  return asEvidenceRef(`${CONTRIBUTION_ID_PREFIXES.evidence}${digest(`evidence:${seed}`).slice(0, 32)}`);
}

export function informationRightRefFor(seed: string): InformationRightRef {
  return asInformationRightRef(`${CONTRIBUTION_ID_PREFIXES.informationRight}${digest(`right:${seed}`).slice(0, 32)}`);
}

export function consentGrantRefFor(seed: string): ConsentGrantRef {
  return asConsentGrantRef(`${CONTRIBUTION_ID_PREFIXES.consent}${digest(`consent:${seed}`).slice(0, 32)}`);
}

export function purposeRefFor(seed: string): PurposeRef {
  return asPurposeRef(`${CONTRIBUTION_ID_PREFIXES.purpose}${digest(`purpose:${seed}`).slice(0, 32)}`);
}

export function provenanceRefFor(seed: string): ProvenanceRef {
  return asProvenanceRef(`${CONTRIBUTION_ID_PREFIXES.provenance}${digest(`provenance:${seed}`).slice(0, 32)}`);
}

export function attestationRefFor(seed: string): AttestationRef {
  return asAttestationRef(`${CONTRIBUTION_ID_PREFIXES.attestation}${digest(`attestation:${seed}`).slice(0, 32)}`);
}

export function usageReceiptRefFor(seed: string): UsageReceiptRef {
  return asUsageReceiptRef(`${CONTRIBUTION_ID_PREFIXES.usageReceipt}${digest(`usage:${seed}`).slice(0, 32)}`);
}

export function cleanRoomResultRefFor(seed: string): CleanRoomResultRef {
  return asCleanRoomResultRef(`${CONTRIBUTION_ID_PREFIXES.cleanRoomResult}${digest(`cleanroom:${seed}`).slice(0, 32)}`);
}

export function pegEventRefFor(seed: string): PegEventRef {
  return asPegEventRef(`${CONTRIBUTION_ID_PREFIXES.pegEvent}${digest(`peg:${seed}`).slice(0, 32)}`);
}

export function ledgerEventRefFor(seed: string): LedgerEventRef {
  return asLedgerEventRef(`${CONTRIBUTION_ID_PREFIXES.ledgerEvent}${digest(`ledger:${seed}`).slice(0, 32)}`);
}

export function paymentEventRefFor(seed: string): PaymentEventRef {
  return asPaymentEventRef(`${CONTRIBUTION_ID_PREFIXES.paymentEvent}${digest(`payment:${seed}`).slice(0, 32)}`);
}

export function cardEventRefFor(seed: string): CardEventRef {
  return asCardEventRef(`${CONTRIBUTION_ID_PREFIXES.cardEvent}${digest(`card:${seed}`).slice(0, 32)}`);
}

export function externalAttestationRefFor(seed: string): ExternalAttestationRef {
  return asExternalAttestationRef(`${CONTRIBUTION_ID_PREFIXES.externalAttestation}${digest(`extatt:${seed}`).slice(0, 32)}`);
}

export function communityAttestationRefFor(seed: string): CommunityAttestationRef {
  return asCommunityAttestationRef(`${CONTRIBUTION_ID_PREFIXES.communityAttestation}${digest(`comatt:${seed}`).slice(0, 32)}`);
}

export function researchAttestationRefFor(seed: string): ResearchAttestationRef {
  return asResearchAttestationRef(`${CONTRIBUTION_ID_PREFIXES.researchAttestation}${digest(`resatt:${seed}`).slice(0, 32)}`);
}

export function professionalAttestationRefFor(seed: string): ProfessionalAttestationRef {
  return asProfessionalAttestationRef(`${CONTRIBUTION_ID_PREFIXES.professionalAttestation}${digest(`proatt:${seed}`).slice(0, 32)}`);
}

export function policyDecisionRefFor(seed: string): PolicyDecisionRef {
  return asPolicyDecisionRef(`${CONTRIBUTION_ID_PREFIXES.policy}${digest(`policy:${seed}`).slice(0, 32)}`);
}

export function sha256Canonical(value: string): string {
  return digest(value);
}
