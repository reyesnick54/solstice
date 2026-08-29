import { sha256Hex } from '../../../security/src/hash.ts';
import { commitCanonical } from '../hash.ts';
import {
  HIGH_VALUE_MINOR_UNITS,
  ORACLE_REQUIRED_DOMAINS,
  evidenceQualityForSource,
  qualityMeetsMinimum,
} from './policy.ts';
import type {
  AccessRejection,
  AccessServiceDomain,
  DeliveryClaim,
  EvidenceProvenance,
  EvidenceQualityLevel,
  EvidenceSourceClass,
  UsageProof,
} from './types.ts';

export type ProvenanceInput = {
  readonly sourceSystem: string;
  readonly sourceClass: EvidenceSourceClass;
  readonly oracleFactRefs?: readonly string[];
  readonly observedAtUtc: string;
  readonly payloadDigest: string;
};

export function buildProvenance(input: ProvenanceInput): EvidenceProvenance {
  const oracleFactRefs = Object.freeze([...(input.oracleFactRefs ?? [])]);
  const contentCommitment = commitCanonical({
    sourceSystem: input.sourceSystem,
    sourceClass: input.sourceClass,
    payloadDigest: input.payloadDigest,
    observedAtUtc: input.observedAtUtc,
  });
  const provenanceDigest = sha256Hex(
    [input.sourceSystem, input.sourceClass, contentCommitment, oracleFactRefs.join('|')].join('\n'),
  );
  return Object.freeze({
    provenanceDigest,
    contentCommitment,
    sourceSystem: input.sourceSystem,
    sourceClass: input.sourceClass,
    oracleFactRefs,
    observedAtUtc: input.observedAtUtc,
  });
}

export function minimumQualityForContext(input: {
  readonly serviceDomain: AccessServiceDomain;
  readonly considerationMinorUnits: bigint;
  readonly settlementGrade: boolean;
}): EvidenceQualityLevel {
  if (input.settlementGrade && ORACLE_REQUIRED_DOMAINS.has(input.serviceDomain)) {
    return 'INDEPENDENT_ORACLE';
  }
  if (input.settlementGrade && input.considerationMinorUnits >= HIGH_VALUE_MINOR_UNITS) {
    return 'INDEPENDENT_ORACLE';
  }
  if (input.settlementGrade) {
    return 'PROVIDER_ATTESTED';
  }
  return 'SELF_REPORT_UNVERIFIED';
}

export function validateProvenance(
  provenance: EvidenceProvenance,
  minimumQuality: EvidenceQualityLevel,
): AccessRejection | null {
  if (!provenance.provenanceDigest || !provenance.contentCommitment || !provenance.sourceSystem) {
    return {
      ok: false,
      code: 'PROVENANCE_REQUIRED',
      message: 'usage and delivery proofs require provenance digest, content commitment, and source system',
      sessionId: null,
    };
  }
  const actual = evidenceQualityForSource(provenance.sourceClass);
  if (!qualityMeetsMinimum(actual, minimumQuality)) {
    if (
      minimumQuality === 'INDEPENDENT_ORACLE' &&
      provenance.sourceClass === 'PROVIDER_SELF_REPORT' &&
      provenance.oracleFactRefs.length === 0
    ) {
      return {
        ok: false,
        code: 'SELF_REPORT_INSUFFICIENT',
        message: 'independent oracle evidence is required; provider self-report alone is not trusted',
        sessionId: null,
      };
    }
    return {
      ok: false,
      code: 'EVIDENCE_QUALITY_INSUFFICIENT',
      message: `${provenance.sourceClass} does not meet required ${minimumQuality}`,
      sessionId: null,
    };
  }
  if (
    minimumQuality === 'INDEPENDENT_ORACLE' &&
    provenance.sourceClass === 'PROVIDER_SELF_REPORT' &&
    provenance.oracleFactRefs.length === 0
  ) {
    return {
      ok: false,
      code: 'SELF_REPORT_INSUFFICIENT',
      message: 'independent oracle evidence is required; provider self-report alone is not trusted',
      sessionId: null,
    };
  }
  return null;
}

export function assertUsageProofProvenance(
  proof: UsageProof,
  minimumQuality: EvidenceQualityLevel,
  sessionId: string,
): AccessRejection | null {
  const rejection = validateProvenance(proof.provenance, minimumQuality);
  if (rejection) {
    return { ...rejection, sessionId };
  }
  if (proof.evidenceQuality !== evidenceQualityForSource(proof.provenance.sourceClass)) {
    return {
      ok: false,
      code: 'PROVENANCE_MISMATCH',
      message: 'usage proof evidence quality does not match provenance source class',
      sessionId,
    };
  }
  return null;
}

export function assertDeliveryClaimProvenance(
  claim: DeliveryClaim,
  minimumQuality: EvidenceQualityLevel,
  sessionId: string,
): AccessRejection | null {
  const rejection = validateProvenance(claim.provenance, minimumQuality);
  if (rejection) {
    return { ...rejection, sessionId };
  }
  if (claim.evidenceQuality !== evidenceQualityForSource(claim.provenance.sourceClass)) {
    return {
      ok: false,
      code: 'PROVENANCE_MISMATCH',
      message: 'delivery claim evidence quality does not match provenance source class',
      sessionId,
    };
  }
  return null;
}
