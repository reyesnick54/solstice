import { createHash, createHmac } from 'node:crypto';

import { type Brand, brandAs } from '../../../domain/src/brand.ts';
import { RESOLUTION_ID_PREFIXES } from './types.ts';
import type {
  AuthoritativeIdCommitment,
  CanonicalHumanContributionEventId,
  ContributionResolutionFingerprint,
  EvidenceObservationId,
  HumanEconomicClaimId,
  HumanEconomicIdentityId,
  MonetizationConsumptionCommitment,
  MonetizationContextId,
  ResolutionClusterId,
  WalletBindingRef,
} from './types.ts';

const HEX_BODY = /^[a-f0-9]{16,64}$/;
const RESOLUTION_DOMAIN_SALT = 'sunrey-human-contribution-resolution-v1';

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

function domainDigest(domain: string, parts: readonly string[]): string {
  return digest([domain, ...parts].join('\n'));
}

function keyedCommitment(domain: string, material: string): string {
  return createHmac('sha256', RESOLUTION_DOMAIN_SALT).update(`${domain}\n${material}`).digest('hex');
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

export function asHumanEconomicIdentityId(value: string): HumanEconomicIdentityId {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.humanEconomicIdentity, 'HumanEconomicIdentityId');
}

export function asCanonicalHumanContributionEventId(value: string): CanonicalHumanContributionEventId {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.canonicalEvent, 'CanonicalHumanContributionEventId');
}

export function asContributionResolutionFingerprint(value: string): ContributionResolutionFingerprint {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.resolutionFingerprint, 'ContributionResolutionFingerprint');
}

export function asAuthoritativeIdCommitment(value: string): AuthoritativeIdCommitment {
  if (value.startsWith(RESOLUTION_ID_PREFIXES.authoritativeId)) {
    return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.authoritativeId, 'AuthoritativeIdCommitment');
  }
  return asPrefixedHex(
    `${RESOLUTION_ID_PREFIXES.authoritativeId}${digest(`authoritative-id:${value}`).slice(0, 32)}`,
    RESOLUTION_ID_PREFIXES.authoritativeId,
    'AuthoritativeIdCommitment',
  );
}

export function asEvidenceObservationId(value: string): EvidenceObservationId {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.evidenceObservation, 'EvidenceObservationId');
}

export function asResolutionClusterId(value: string): ResolutionClusterId {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.resolutionCluster, 'ResolutionClusterId');
}

export function asHumanEconomicClaimId(value: string): HumanEconomicClaimId {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.humanEconomicClaim, 'HumanEconomicClaimId');
}

export function asWalletBindingRef(value: string): WalletBindingRef {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.walletBinding, 'WalletBindingRef');
}

export function asMonetizationContextId(value: string): MonetizationContextId {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.monetizationContext, 'MonetizationContextId');
}

export function asMonetizationConsumptionCommitment(value: string): MonetizationConsumptionCommitment {
  return asPrefixedHex(value, RESOLUTION_ID_PREFIXES.consumptionCommitment, 'MonetizationConsumptionCommitment');
}

export function humanEconomicIdentityIdFor(material: { readonly actorCommitment: string; readonly jurisdiction?: string }): HumanEconomicIdentityId {
  return asHumanEconomicIdentityId(
    `${RESOLUTION_ID_PREFIXES.humanEconomicIdentity}${keyedCommitment('human-economic-identity', [material.actorCommitment, material.jurisdiction ?? ''].join('\n')).slice(0, 32)}`,
  );
}

export function walletBindingRefFor(material: { readonly walletCommitment: string; readonly humanEconomicIdentityId: HumanEconomicIdentityId }): WalletBindingRef {
  return asWalletBindingRef(
    `${RESOLUTION_ID_PREFIXES.walletBinding}${digest(`wallet-binding:${material.walletCommitment}:${material.humanEconomicIdentityId}`).slice(0, 32)}`,
  );
}

export function canonicalHumanContributionEventIdFor(material: string): CanonicalHumanContributionEventId {
  return asCanonicalHumanContributionEventId(
    `${RESOLUTION_ID_PREFIXES.canonicalEvent}${domainDigest('canonical-human-contribution-event', [material]).slice(0, 32)}`,
  );
}

export function contributionResolutionFingerprintFor(material: string): ContributionResolutionFingerprint {
  return asContributionResolutionFingerprint(
    `${RESOLUTION_ID_PREFIXES.resolutionFingerprint}${keyedCommitment('contribution-resolution-fingerprint', material).slice(0, 32)}`,
  );
}

export function resolutionClusterIdFor(canonicalEventId: CanonicalHumanContributionEventId): ResolutionClusterId {
  return asResolutionClusterId(
    `${RESOLUTION_ID_PREFIXES.resolutionCluster}${domainDigest('resolution-cluster', [canonicalEventId]).slice(0, 32)}`,
  );
}

export function humanEconomicClaimIdFor(canonicalEventId: CanonicalHumanContributionEventId, humanEconomicIdentityId: HumanEconomicIdentityId): HumanEconomicClaimId {
  return asHumanEconomicClaimId(
    `${RESOLUTION_ID_PREFIXES.humanEconomicClaim}${domainDigest('human-economic-claim', [canonicalEventId, humanEconomicIdentityId]).slice(0, 32)}`,
  );
}

export function authoritativeIdCommitmentFrom(kind: string, valueCommitment: string): AuthoritativeIdCommitment {
  return asAuthoritativeIdCommitment(`${kind}:${valueCommitment}`);
}

export function actorCommitmentFromAnchors(anchors: readonly string[]): string {
  return keyedCommitment('actor-anchor', [...anchors].sort().join('\n'));
}

export function contentCommitmentFromEvidence(evidenceDigests: readonly string[]): string {
  return domainDigest('content-commitment', [...evidenceDigests].sort());
}

export function observationReplayKey(providerId: string, providerRecordId: string, payloadDigest: string): string {
  return domainDigest('observation-replay', [providerId, providerRecordId, payloadDigest]);
}

export function monetizationKeyOf(resolutionFingerprint: ContributionResolutionFingerprint, contextId: MonetizationContextId): string {
  return domainDigest('monetization-key', [resolutionFingerprint, contextId]);
}

export function consumptionCommitmentOf(
  resolutionFingerprint: ContributionResolutionFingerprint,
  contextId: MonetizationContextId,
  replayKey: string,
): MonetizationConsumptionCommitment {
  return asMonetizationConsumptionCommitment(
    `${RESOLUTION_ID_PREFIXES.consumptionCommitment}${domainDigest('consumption-commitment', [resolutionFingerprint, contextId, replayKey]).slice(0, 32)}`,
  );
}

export function evidenceObservationIdFor(seed: string): EvidenceObservationId {
  return asEvidenceObservationId(
    `${RESOLUTION_ID_PREFIXES.evidenceObservation}${digest(`evidence-observation:${seed}`).slice(0, 32)}`,
  );
}
