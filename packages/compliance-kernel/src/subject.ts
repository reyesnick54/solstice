import type { DecisionStatus } from '@solstice/permissions';

export const IDENTITY_ASSURANCES = ['VERIFIED', 'UNVERIFIED', 'UNKNOWN'] as const;
export type IdentityAssurance = (typeof IDENTITY_ASSURANCES)[number];

export const RISK_POSTURES = ['ACCEPTABLE', 'ELEVATED', 'UNACCEPTABLE'] as const;
export type RiskPosture = (typeof RISK_POSTURES)[number];

export const KYC_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
] as const;
export type SubjectKycState = (typeof KYC_STATES)[number];

/**
 * Facts the Kernel evaluates. Application services must not evaluate these
 * proofs; they register subject facts and submit an ActionIntent.
 *
 * These are not jurisdiction-pack rules. Country product restrictions belong
 * in policy packs (ADR-0006). This record is the six-proof input only.
 */
export type SubjectRecord = {
  readonly actorId: string;
  readonly identityAssurance: IdentityAssurance;
  readonly capabilities: readonly string[];
  readonly jurisdiction: string;
  readonly kycState: SubjectKycState;
  readonly riskPosture: RiskPosture;
  readonly permittedPurposes: readonly string[];
};

export type SubjectStore = {
  get(actorId: string): SubjectRecord | undefined;
  register(subject: SubjectRecord): void;
};

export function createSubjectStore(): SubjectStore {
  const byActor = new Map<string, SubjectRecord>();
  return {
    get(actorId) {
      return byActor.get(actorId);
    },
    register(subject) {
      byActor.set(subject.actorId, Object.freeze({ ...subject }));
    },
  };
}

export function identityProof(subject: SubjectRecord | undefined): {
  status: DecisionStatus;
  reason: string;
} {
  if (!subject) {
    return { status: 'BLOCK', reason: 'Identity proof: actor is unknown' };
  }
  if (subject.identityAssurance === 'VERIFIED') {
    return { status: 'ALLOW', reason: 'Identity proof: actor identity is verified' };
  }
  if (subject.identityAssurance === 'UNVERIFIED') {
    return {
      status: 'REQUIRE_MANUAL_REVIEW',
      reason: 'Identity proof: actor identity is unverified',
    };
  }
  return { status: 'BLOCK', reason: 'Identity proof: actor identity is unknown' };
}

export function authorityProof(
  subject: SubjectRecord | undefined,
  actionType: string,
): { status: DecisionStatus; reason: string } {
  if (!subject) {
    return { status: 'BLOCK', reason: 'Authority proof: actor is unknown' };
  }
  if (subject.capabilities.includes(actionType)) {
    return {
      status: 'ALLOW',
      reason: `Authority proof: actor holds capability ${actionType}`,
    };
  }
  return {
    status: 'BLOCK',
    reason: `Authority proof: actor lacks capability ${actionType}`,
  };
}

export function jurisdictionProof(
  subject: SubjectRecord | undefined,
  intentJurisdiction: string,
): { status: DecisionStatus; reason: string } {
  if (!subject) {
    return { status: 'BLOCK', reason: 'Jurisdiction proof: actor is unknown' };
  }
  if (!/^[A-Z]{2}$/.test(intentJurisdiction)) {
    return {
      status: 'BLOCK',
      reason: 'Jurisdiction proof: intent jurisdiction is not an ISO 3166-1 alpha-2 code',
    };
  }
  if (subject.jurisdiction !== intentJurisdiction) {
    return {
      status: 'BLOCK',
      reason: 'Jurisdiction proof: intent jurisdiction does not match the subject cell',
    };
  }
  return {
    status: 'ALLOW',
    reason: 'Jurisdiction proof: intent jurisdiction matches the subject cell',
  };
}

export function complianceProof(subject: SubjectRecord | undefined): {
  status: DecisionStatus;
  reason: string;
} {
  if (!subject) {
    return { status: 'BLOCK', reason: 'Compliance proof: actor is unknown' };
  }
  if (subject.kycState === 'VERIFIED') {
    return { status: 'ALLOW', reason: 'Compliance proof: KYC is verified' };
  }
  if (subject.kycState === 'IN_PROGRESS') {
    return { status: 'DEFER', reason: 'Compliance proof: KYC is in progress' };
  }
  if (subject.kycState === 'NOT_STARTED') {
    return {
      status: 'REQUIRE_MANUAL_REVIEW',
      reason: 'Compliance proof: KYC has not started',
    };
  }
  return {
    status: 'BLOCK',
    reason: `Compliance proof: KYC state is ${subject.kycState}`,
  };
}

export function riskProof(subject: SubjectRecord | undefined): {
  status: DecisionStatus;
  reason: string;
} {
  if (!subject) {
    return { status: 'BLOCK', reason: 'Risk proof: actor is unknown' };
  }
  if (subject.riskPosture === 'ACCEPTABLE') {
    return { status: 'ALLOW', reason: 'Risk proof: posture is acceptable' };
  }
  if (subject.riskPosture === 'ELEVATED') {
    return {
      status: 'REQUIRE_MANUAL_REVIEW',
      reason: 'Risk proof: posture is elevated',
    };
  }
  return { status: 'BLOCK', reason: 'Risk proof: posture is unacceptable' };
}

export function purposeProof(
  subject: SubjectRecord | undefined,
  purpose: string,
  actionType: string,
): { status: DecisionStatus; reason: string } {
  if (!subject) {
    return { status: 'BLOCK', reason: 'Purpose proof: actor is unknown' };
  }
  if (purpose !== actionType) {
    return {
      status: 'BLOCK',
      reason: 'Purpose proof: stated purpose does not match the action type',
    };
  }
  if (subject.permittedPurposes.includes(purpose)) {
    return { status: 'ALLOW', reason: `Purpose proof: ${purpose} is permitted` };
  }
  return {
    status: 'BLOCK',
    reason: `Purpose proof: ${purpose} is not a permitted purpose`,
  };
}
