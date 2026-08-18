/**
 * Independent capability activation packages.
 *
 * A healthy chain does not authorize Exchange, custody, fiat, payments,
 * cards, investments, Human Information, productive markets, or interop.
 * One package cannot be replayed across network, chain, release,
 * capability, or policy version. AI can prepare evidence summaries and
 * cannot authorize activation.
 */

import type { EmergencyActionClass } from '../governance-ops/types.ts';
import { commitPostGenesis } from './hash.ts';
import {
  REHEARSAL_CHAIN_ID,
  REHEARSAL_NETWORK_ID,
  REHEARSAL_POLICY_VERSION,
  REHEARSAL_PROTOCOL,
  REHEARSAL_RELEASE_ID,
} from './identity.ts';
import { restrictionFor } from './restrictions.ts';
import type {
  CapabilityActivationEvidence,
  CapabilityActivationPackage,
  CapabilityActivationResult,
  CapabilityEvidenceSlot,
  CapabilityHistoryEntry,
  HumanAuthorityRecord,
  IndependentCapability,
  PostGenesisEvidenceState,
  PostGenesisPolicy,
} from './types.ts';
import { INDEPENDENT_CAPABILITIES, REGULATED_CAPABILITIES } from './types.ts';

export function isRegulatedCapability(capability: IndependentCapability): boolean {
  return (REGULATED_CAPABILITIES as readonly string[]).includes(capability);
}

export function emptySlot(
  slotId: string,
  description: string,
  required: boolean,
  external: boolean,
  state: PostGenesisEvidenceState = 'NOT_PROVIDED',
): CapabilityEvidenceSlot {
  return Object.freeze({ slotId, description, state, required, external });
}

export function evidenceFor(capability: IndependentCapability): CapabilityActivationEvidence {
  const providers = requiredProviderSlots(capability);
  const legal = requiredLegalSlots(capability);
  const regulatory = requiredRegulatorySlots(capability);
  const security = requiredSecuritySlots(capability);
  const operations = requiredOperationsSlots(capability);
  const human = [
    emptySlot('HUM-AUTHORITY', 'Human production activation authority', true, true),
  ];
  const privacy = capability === 'HUMAN_INFORMATION_MARKET'
    ? [
        emptySlot('PRIV-CONSENT', 'Subject consent', true, true),
        emptySlot('PRIV-PURPOSE', 'Purpose limitation', true, true),
        emptySlot('PRIV-REVIEW', 'Privacy review', true, true),
        emptySlot('PRIV-LEGAL', 'Legal evidence for Human Information market', true, true),
        emptySlot('PRIV-CLEAN-ROOM', 'Clean Room readiness', true, true),
        emptySlot('PRIV-MARKET', 'Market authorization', true, true),
      ]
    : [emptySlot('PRIV-DEFAULT-DENY', 'Privacy remains default-deny; raw PDV unavailable', true, false, 'ENGINEERING_VERIFIED')];
  return Object.freeze({
    packageId: '',
    capability,
    legal,
    regulatory,
    security,
    operations,
    providers,
    human,
    privacy,
  });
}

export function hashActivationPackage(input: Omit<CapabilityActivationPackage, 'packageHash'>): string {
  return commitPostGenesis({
    capability: input.capability,
    networkId: input.networkId,
    chainId: input.chainId,
    releaseId: input.releaseId,
    activeProtocol: input.activeProtocol,
    policyVersion: input.policyVersion,
    requiredProviders: input.requiredProviders,
    evidence: input.evidence,
    humanAuthority: input.humanAuthority,
    activationCoordinate: input.activationCoordinate,
    restrictions: input.restrictions,
  });
}

export function assembleActivationPackage(input: {
  readonly capability: IndependentCapability;
  readonly policy?: PostGenesisPolicy;
  readonly evidence?: CapabilityActivationEvidence;
  readonly humanAuthority?: readonly HumanAuthorityRecord[];
  readonly networkId?: string;
  readonly chainId?: string;
  readonly releaseId?: string;
  readonly policyVersion?: string;
  readonly requiredProviders?: readonly string[];
  readonly restrictions?: readonly EmergencyActionClass[];
  readonly height?: number;
  readonly epoch?: number;
}): CapabilityActivationPackage {
  const policy = input.policy;
  const evidence = input.evidence ?? evidenceFor(input.capability);
  const draft: Omit<CapabilityActivationPackage, 'packageHash'> = {
    packageId: `cap_${input.capability.toLowerCase()}_pkg`,
    capability: input.capability,
    networkId: input.networkId ?? policy?.networkId ?? REHEARSAL_NETWORK_ID,
    chainId: input.chainId ?? policy?.chainId ?? REHEARSAL_CHAIN_ID,
    releaseId: input.releaseId ?? policy?.releaseId ?? REHEARSAL_RELEASE_ID,
    activeProtocol: policy?.activeProtocol ?? REHEARSAL_PROTOCOL,
    policyVersion: input.policyVersion ?? policy?.policyVersion ?? REHEARSAL_POLICY_VERSION,
    requiredProviders: Object.freeze([...(input.requiredProviders ?? requiredProviderIds(input.capability))]),
    evidence,
    humanAuthority: Object.freeze([...(input.humanAuthority ?? [])]),
    activationCoordinate: Object.freeze({
      kind: 'HEIGHT',
      height: input.height ?? 32,
      epoch: input.epoch ?? 2,
      checkpointId: null,
    }),
    restrictions: Object.freeze([...(input.restrictions ?? restrictionFor(input.capability))]),
  };
  return Object.freeze({
    ...draft,
    packageHash: hashActivationPackage(draft),
  });
}

export function verifyActivationPackage(
  pkg: CapabilityActivationPackage,
  policy: PostGenesisPolicy,
  usedHashes: ReadonlySet<string>,
): CapabilityActivationResult {
  const reasons: string[] = [];
  if (pkg.networkId !== policy.networkId) {
    reasons.push('wrong-network package rejected');
  }
  if (pkg.chainId !== policy.chainId) {
    reasons.push('package chain does not match active chain');
  }
  if (pkg.releaseId !== policy.releaseId) {
    reasons.push('package release does not match active release');
  }
  if (pkg.policyVersion !== policy.policyVersion) {
    reasons.push('package policy version does not match active policy');
  }
  if (pkg.activeProtocol !== policy.activeProtocol) {
    reasons.push('package protocol does not match active protocol');
  }
  if (usedHashes.has(pkg.packageHash)) {
    reasons.push('replayed package rejected');
  }
  if (pkg.humanAuthority.some((row) => row.actorKind !== 'HUMAN')) {
    reasons.push('AI activation rejected');
  }
  const humanAuthorized = pkg.humanAuthority.some((row) => row.actorKind === 'HUMAN' && row.accepted);
  if (!humanAuthorized) {
    reasons.push('missing authority cannot activate');
  }
  const missing = missingRequiredEvidence(pkg).filter((row) => !(humanAuthorized && row.includes('HUM-AUTHORITY')));
  reasons.push(...missing);
  if (pkg.capability === 'SUNREY_EXCHANGE' && missing.length > 0) {
    reasons.push('Exchange activation without required evidence rejected');
  }
  if (pkg.capability === 'INSTITUTIONAL_CUSTODY' && !evidenceSatisfied(pkg.evidence.security, 'SEC-HSM')) {
    reasons.push('custody activation without HSM evidence rejected');
  }
  if (pkg.capability === 'FIAT_BANKING' && !evidenceSatisfied(pkg.evidence.providers, 'PROV-BANK')) {
    reasons.push('fiat activation without banking evidence rejected');
  }
  if (pkg.capability === 'HUMAN_INFORMATION_MARKET' && missing.some((row) => row.startsWith('privacy') || row.includes('LEG-HIM') || row.includes('LEG-LEGAL'))) {
    reasons.push('Human Information market without privacy/legal evidence rejected');
  }
  const unique = [...new Set(reasons)];
  const accepted = unique.length === 0;
  return Object.freeze({
    packageId: pkg.packageId,
    capability: pkg.capability,
    outcome: accepted ? 'ACTIVATED' : 'REJECTED',
    reasons: Object.freeze(unique),
    runtimeEnabled: accepted,
    restrictionState: accepted ? 'INACTIVE' : 'ACTIVE',
    realProductionCapabilitiesActivated: false,
  });
}

export function historyEntry(
  pkg: CapabilityActivationPackage,
  result: CapabilityActivationResult,
): CapabilityHistoryEntry {
  return Object.freeze({
    packageId: pkg.packageId,
    capability: pkg.capability,
    packageHash: pkg.packageHash,
    networkId: pkg.networkId,
    chainId: pkg.chainId,
    releaseId: pkg.releaseId,
    policyVersion: pkg.policyVersion,
    authority: pkg.humanAuthority.map((row) => `${row.actorKind}:${row.actorId}`).join(',') || 'NONE',
    coordinate: pkg.activationCoordinate,
    result: result.outcome,
    restrictions: Object.freeze([...pkg.restrictions]),
    reasons: result.reasons,
  });
}

export function defaultDisabledStatuses(): readonly IndependentCapability[] {
  return INDEPENDENT_CAPABILITIES;
}

function missingRequiredEvidence(pkg: CapabilityActivationPackage): readonly string[] {
  const groups: ReadonlyArray<readonly CapabilityEvidenceSlot[]> = [
    pkg.evidence.legal,
    pkg.evidence.regulatory,
    pkg.evidence.security,
    pkg.evidence.operations,
    pkg.evidence.providers,
    pkg.evidence.human,
    pkg.evidence.privacy,
  ];
  const missing: string[] = [];
  for (const group of groups) {
    for (const slot of group) {
      if (slot.required && slot.state !== 'HUMAN_VERIFIED' && slot.state !== 'ENGINEERING_VERIFIED' && slot.state !== 'NOT_APPLICABLE') {
        const plane = slot.slotId.startsWith('PRIV') ? 'privacy' : slot.slotId.split('-')[0]?.toLowerCase() ?? 'evidence';
        missing.push(`${plane} evidence ${slot.slotId} is ${slot.state}`);
      }
    }
  }
  return Object.freeze(missing);
}

function evidenceSatisfied(slots: readonly CapabilityEvidenceSlot[], slotId: string): boolean {
  const found = slots.find((slot) => slot.slotId === slotId);
  return found?.state === 'HUMAN_VERIFIED' || found?.state === 'ENGINEERING_VERIFIED';
}

function requiredProviderIds(capability: IndependentCapability): readonly string[] {
  switch (capability) {
    case 'SUNREY_EXCHANGE':
      return Object.freeze(['exchange-matching', 'custody', 'surveillance']);
    case 'INSTITUTIONAL_CUSTODY':
      return Object.freeze(['production-hsm', 'custody-provider']);
    case 'FIAT_BANKING':
    case 'PAYMENT_RAILS':
      return Object.freeze(['external-bank', 'payment-rail']);
    case 'CARDS':
      return Object.freeze(['card-processor']);
    case 'HUMAN_INFORMATION_MARKET':
      return Object.freeze(['clean-room']);
    case 'PRODUCTIVE_CAPACITY_MARKET':
      return Object.freeze(['production-oracle']);
    case 'INTEROPERABILITY':
      return Object.freeze(['interop-channel']);
    default:
      return Object.freeze([]);
  }
}

function requiredProviderSlots(capability: IndependentCapability): readonly CapabilityEvidenceSlot[] {
  switch (capability) {
    case 'SUNREY_EXCHANGE':
      return Object.freeze([
        emptySlot('PROV-EXCHANGE', 'Accepted Exchange provider', true, true),
        emptySlot('PROV-CUSTODY', 'Custody readiness for Exchange', true, true),
        emptySlot('PROV-SURVEILLANCE', 'Surveillance provider readiness', true, true),
      ]);
    case 'INSTITUTIONAL_CUSTODY':
      return Object.freeze([
        emptySlot('PROV-HSM', 'Verified production signer/HSM', true, true),
        emptySlot('PROV-CUSTODY', 'Custody provider readiness', true, true),
      ]);
    case 'FIAT_BANKING':
    case 'PAYMENT_RAILS':
      return Object.freeze([
        emptySlot('PROV-BANK', 'Accepted external banking/payment dependency', true, true),
      ]);
    case 'PRODUCTIVE_CAPACITY_MARKET':
      return Object.freeze([
        emptySlot('PROV-ORACLE', 'Production oracle eligibility', true, true),
      ]);
    case 'INTEROPERABILITY':
      return Object.freeze([
        emptySlot('PROV-INTEROP', 'Independently governed interop channel; no trusted bridge root', true, true),
      ]);
    default:
      return Object.freeze([]);
  }
}

function requiredLegalSlots(capability: IndependentCapability): readonly CapabilityEvidenceSlot[] {
  if (capability === 'SUNREY_EXCHANGE') {
    return Object.freeze([
      emptySlot('LEG-MARKET', 'Market/legal evidence', true, true),
      emptySlot('LEG-COMPLIANCE', 'Compliance evidence', true, true),
    ]);
  }
  if (capability === 'HUMAN_INFORMATION_MARKET') {
    return Object.freeze([emptySlot('LEG-HIM', 'Legal evidence for Human Information market', true, true)]);
  }
  if (isRegulatedCapability(capability) || capability === 'INTEROPERABILITY') {
    return Object.freeze([emptySlot('LEG-POLICY', 'Legal or policy evidence', true, true)]);
  }
  return Object.freeze([emptySlot('LEG-NA', 'No additional legal slot for this rehearsal capability', false, false, 'NOT_APPLICABLE')]);
}

function requiredRegulatorySlots(capability: IndependentCapability): readonly CapabilityEvidenceSlot[] {
  if (capability === 'SUNREY_EXCHANGE' || capability === 'FIAT_BANKING' || capability === 'PAYMENT_RAILS' || capability === 'CARDS' || capability === 'INVESTMENTS') {
    return Object.freeze([emptySlot('REG-LICENSE', 'License or partner registration', true, true)]);
  }
  return Object.freeze([emptySlot('REG-NA', 'No additional regulatory slot', false, false, 'NOT_APPLICABLE')]);
}

function requiredSecuritySlots(capability: IndependentCapability): readonly CapabilityEvidenceSlot[] {
  if (capability === 'INSTITUTIONAL_CUSTODY') {
    return Object.freeze([
      emptySlot('SEC-HSM', 'Verified production signer/HSM evidence', true, true),
      emptySlot('SEC-RECON', 'Reconciliation evidence', true, true),
      emptySlot('SEC-REVIEW', 'Custody security review', true, true),
    ]);
  }
  if (capability === 'SUNREY_EXCHANGE' || capability === 'INTEROPERABILITY') {
    return Object.freeze([emptySlot('SEC-REVIEW', 'Security evidence', true, true)]);
  }
  return Object.freeze([emptySlot('SEC-NA', 'No additional security slot', false, false, 'NOT_APPLICABLE')]);
}

function requiredOperationsSlots(capability: IndependentCapability): readonly CapabilityEvidenceSlot[] {
  if (capability === 'INSTITUTIONAL_CUSTODY') {
    return Object.freeze([
      emptySlot('OPS-POLICY', 'Custody withdrawal policy', true, true),
      emptySlot('OPS-EXTERNAL', 'External custody requirements', true, true),
    ]);
  }
  if (capability === 'SUNREY_EXCHANGE') {
    return Object.freeze([emptySlot('OPS-STAFF', 'Exchange operations staffing', true, true)]);
  }
  if (capability === 'PRODUCTIVE_CAPACITY_MARKET') {
    return Object.freeze([emptySlot('OPS-POLICY', 'Productive policy eligibility', true, true)]);
  }
  return Object.freeze([emptySlot('OPS-NA', 'No additional operations slot', false, false, 'NOT_APPLICABLE')]);
}

export function fillEvidence(
  evidence: CapabilityActivationEvidence,
  slotId: string,
  state: PostGenesisEvidenceState,
): CapabilityActivationEvidence {
  const update = (slots: readonly CapabilityEvidenceSlot[]) =>
    Object.freeze(slots.map((slot) => (slot.slotId === slotId ? { ...slot, state } : slot)));
  return Object.freeze({
    ...evidence,
    legal: update(evidence.legal),
    regulatory: update(evidence.regulatory),
    security: update(evidence.security),
    operations: update(evidence.operations),
    providers: update(evidence.providers),
    human: update(evidence.human),
    privacy: update(evidence.privacy),
  });
}
