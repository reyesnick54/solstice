/**
 * Deterministic canonical encoding for Wave 3 economic proof objects.
 *
 * Field order is fixed. Integers are unsigned big-endian. Strings are
 * length-prefixed UTF-8. Repeated fields are sorted before encoding.
 * Reuses Wave 2 length-prefixed codec primitives from blocks/codec.ts.
 */

import { createHash } from 'node:crypto';

import { domainPayload, encodeString, encodeU64 } from '../blocks/codec.ts';
import { PROTOCOL_CHAIN_ID, PROTOCOL_NETWORK_ID } from '../protocol/constants.ts';
import { PROOF_HASH_DOMAINS } from './constants.ts';
import type {
  CanonicalEconomicClaim,
  EconomicEvidence,
  EconomicObservation,
  GeographicBounds,
  GeographicContext,
  LabeledQuantity,
  TemporalBounds,
  VerifiedEconomicFact,
} from './types.ts';

function encodeU32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value >>> 0);
  return out;
}

function encodeBigInt(value: bigint): Buffer {
  if (value < 0n) {
    throw new TypeError('negative bigint is not allowed in proof encoding');
  }
  return encodeU64(value);
}

function encodeOptionalString(value: string | null): Buffer {
  if (value === null) {
    return encodeU32(0);
  }
  return Buffer.concat([encodeU32(1), encodeString(value)]);
}

function encodeStringList(values: readonly string[]): Buffer {
  const sorted = [...values].sort();
  const parts = [encodeU32(sorted.length)];
  for (const value of sorted) {
    parts.push(encodeString(value));
  }
  return Buffer.concat(parts);
}

function encodeGeographicContext(value: GeographicContext): Buffer {
  return Buffer.concat([
    encodeString(value.jurisdiction),
    encodeOptionalString(value.region),
    encodeOptionalString(value.locality),
  ]);
}

function encodeTemporalBounds(value: TemporalBounds): Buffer {
  return Buffer.concat([encodeString(value.startUtc), encodeString(value.endUtc)]);
}

function encodeGeographicBounds(value: GeographicBounds): Buffer {
  return Buffer.concat([encodeString(value.jurisdiction), encodeOptionalString(value.region)]);
}

function encodeLabeledQuantity(value: LabeledQuantity): Buffer {
  return Buffer.concat([encodeBigInt(value.value), encodeString(value.unit), encodeString(value.metric)]);
}

export function encodeEconomicObservation(observation: EconomicObservation): Buffer {
  return Buffer.concat([
    encodeString(observation.schemaVersion),
    encodeString(observation.observationId),
    encodeString(observation.providerId),
    encodeString(observation.sourceClass),
    encodeString(observation.economicDomain),
    encodeString(observation.subjectRef),
    encodeOptionalString(observation.resourceRef),
    encodeLabeledQuantity(observation.quantity),
    encodeString(observation.observedAtUtc),
    encodeString(observation.receivedAtUtc),
    encodeGeographicContext(observation.geographicContext),
    encodeString(observation.jurisdiction),
    encodeString(observation.provenanceRef.provenanceId),
    encodeStringList(observation.evidenceRefs),
    encodeString(observation.licenseRef.licenseId),
    encodeString(observation.verificationStatus),
    encodeU32(observation.confidence.scoreBps),
    encodeString(observation.freshness.state),
    encodeString(observation.integrity),
  ]);
}

export function encodeEconomicEvidence(evidence: EconomicEvidence): Buffer {
  const materialParts = evidence.materials
    .map((material) =>
      Buffer.concat([
        encodeString(material.kind),
        encodeString(material.materialDigest),
        encodeOptionalString(material.externalRef),
        encodeOptionalString(material.attestationRef),
      ]),
    )
    .sort((left, right) => Buffer.compare(left, right));

  return Buffer.concat([
    encodeString(evidence.schemaVersion),
    encodeString(evidence.evidenceId),
    encodeString(evidence.economicDomain),
    encodeString(evidence.subjectRef),
    encodeStringList(evidence.observationIds),
    encodeU32(materialParts.length),
    ...materialParts,
    encodeString(evidence.purposeDigest),
    encodeOptionalString(evidence.consentReceiptDigest),
    encodeString(evidence.sealedAtUtc),
    encodeString(evidence.contentCommitment),
  ]);
}

export function encodeVerifiedEconomicFact(fact: VerifiedEconomicFact): Buffer {
  const verifierParts = fact.verifiers
    .map((verifier) =>
      Buffer.concat([
        encodeString(verifier.verifierId),
        encodeString(verifier.verifierClass),
        encodeOptionalString(verifier.signatureRef),
      ]),
    )
    .sort((left, right) => Buffer.compare(left, right));

  return Buffer.concat([
    encodeString(fact.schemaVersion),
    encodeString(fact.verifiedFactId),
    encodeString(fact.economicDomain),
    encodeString(fact.subjectRef),
    encodeOptionalString(fact.resourceRef),
    encodeLabeledQuantity(fact.quantity),
    encodeString(fact.verificationMethodologyId),
    encodeString(fact.verificationMethodologyVersion),
    encodeStringList(fact.supportingEvidenceIds),
    encodeString(fact.verifiedAtUtc),
    encodeU32(verifierParts.length),
    ...verifierParts,
    encodeU32(fact.confidence.scoreBps),
    encodeString(fact.verificationStatus),
    encodeString(fact.challengeStatus),
    encodeTemporalBounds(fact.temporalBounds),
    encodeGeographicBounds(fact.geographicBounds),
  ]);
}

export function encodeCanonicalEconomicClaim(claim: CanonicalEconomicClaim): Buffer {
  const policyParts = claim.policyRefs
    .map((policy) =>
      Buffer.concat([
        encodeString(policy.policyId),
        encodeString(policy.policyVersion),
        encodeString(policy.methodologyDigest),
      ]),
    )
    .sort((left, right) => Buffer.compare(left, right));

  return Buffer.concat([
    encodeString(claim.schemaVersion),
    encodeString(claim.economicClaimId),
    encodeString(claim.claimType),
    encodeString(claim.economicDomain),
    encodeString(claim.canonicalEntityId),
    encodeString(claim.canonicalEventId),
    encodeString(claim.subjectRef),
    encodeOptionalString(claim.resourceRef),
    encodeTemporalBounds(claim.temporalBounds),
    encodeGeographicBounds(claim.geographicBounds),
    encodeStringList(claim.supportingFactIds),
    encodeStringList(claim.evidenceRefs),
    encodeString(claim.duplicateFingerprint),
    encodeString(claim.verificationStatus),
    encodeString(claim.challengeStatus),
    encodeString(claim.monetizationStatus),
    encodeU32(policyParts.length),
    ...policyParts,
    encodeOptionalString(claim.lineage.parentClaimId),
    encodeOptionalString(claim.lineage.supersededByClaimId),
  ]);
}

function proofHash(domain: string, payload: Buffer): string {
  return createHash('sha256').update(domainPayload(domain, payload)).digest('hex');
}

export function observationCommitment(
  observation: EconomicObservation,
  networkId: string = PROTOCOL_NETWORK_ID,
  chainId: string = PROTOCOL_CHAIN_ID,
): string {
  const payload = Buffer.concat([encodeString(networkId), encodeString(chainId), encodeEconomicObservation(observation)]);
  return proofHash(PROOF_HASH_DOMAINS.observation, payload);
}

export function evidenceCommitment(
  evidence: EconomicEvidence,
  networkId: string = PROTOCOL_NETWORK_ID,
  chainId: string = PROTOCOL_CHAIN_ID,
): string {
  const payload = Buffer.concat([encodeString(networkId), encodeString(chainId), encodeEconomicEvidence(evidence)]);
  return proofHash(PROOF_HASH_DOMAINS.evidence, payload);
}

export function verifiedFactCommitment(
  fact: VerifiedEconomicFact,
  networkId: string = PROTOCOL_NETWORK_ID,
  chainId: string = PROTOCOL_CHAIN_ID,
): string {
  const payload = Buffer.concat([encodeString(networkId), encodeString(chainId), encodeVerifiedEconomicFact(fact)]);
  return proofHash(PROOF_HASH_DOMAINS.verifiedFact, payload);
}

export function claimCommitment(
  claim: CanonicalEconomicClaim,
  networkId: string = PROTOCOL_NETWORK_ID,
  chainId: string = PROTOCOL_CHAIN_ID,
): string {
  const payload = Buffer.concat([encodeString(networkId), encodeString(chainId), encodeCanonicalEconomicClaim(claim)]);
  return proofHash(PROOF_HASH_DOMAINS.claim, payload);
}

export function chainCommitmentRepresentation(input: {
  readonly objectType: 'observation' | 'evidence' | 'verifiedFact' | 'claim';
  readonly objectId: string;
  readonly schemaVersion: string;
  readonly commitment: string;
  readonly economicDomain: string;
}): {
  readonly objectType: string;
  readonly objectId: string;
  readonly schemaVersion: string;
  readonly commitment: string;
  readonly economicDomain: string;
  readonly rawPayloadRequired: false;
} {
  return Object.freeze({
    objectType: input.objectType,
    objectId: input.objectId,
    schemaVersion: input.schemaVersion,
    commitment: input.commitment,
    economicDomain: input.economicDomain,
    rawPayloadRequired: false,
  });
}
