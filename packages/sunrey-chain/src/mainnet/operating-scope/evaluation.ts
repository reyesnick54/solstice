/**
 * Evidence-backed operating-scope evaluation.
 *
 * Unknown is disabled. Missing evidence is disabled. Fixture counsel
 * is insufficient. Engineering tests are not legal approval. The
 * Regulatory Twin cannot upgrade a row to EXTERNALLY_VERIFIED.
 * This module never issues Execution Authority.
 */

import type { ActivationDomain } from '../types.ts';
import { findCorridor } from './corridors.ts';
import {
  engineeringTestIsNotLegal,
  evidenceCoversDomain,
  evidenceIsExpired,
  evidenceIsRevoked,
  evidenceMatchesEntity,
  fixtureCounselIsInsufficient,
} from './evidence-bindings.ts';
import { isKnownJurisdiction } from './jurisdictions.ts';
import { findLegalEntity } from './products.ts';
import { findProvider } from './provider-bindings.ts';
import { reasonCodeForClass, requirementsFor } from './requirements.ts';
import type {
  OperatingScopeActorKind,
  OperatingScopeCatalog,
  OperatingScopeEvaluation,
  OperatingScopeFact,
  OperatingScopeQuery,
  OperatingScopeReasonCode,
  OperatingScopeStatus,
  ScopeEvidenceRecord,
} from './types.ts';

const NON_HUMAN: ReadonlySet<OperatingScopeActorKind> = new Set([
  'AI',
  'S3M',
  'GROK',
  'AGENT',
  'AUTOMATION',
  'SERVICE',
]);

export function evaluateOperatingScope(
  query: OperatingScopeQuery,
  catalog: OperatingScopeCatalog,
): OperatingScopeEvaluation {
  const nowUtc = query.nowUtc ?? '2026-08-20T00:00:00Z';
  const reasons = new Set<OperatingScopeReasonCode>();
  const missing: string[] = [];
  const evidenceRefs: string[] = [];
  let status: OperatingScopeStatus = 'RESEARCH_REQUIRED';

  reasons.add('PRODUCTION_INACTIVE');

  if (query.twinOverlay) {
    reasons.add('TWIN_CANNOT_EXTERNALLY_VERIFY');
  }
  if (query.actorKind && NON_HUMAN.has(query.actorKind)) {
    reasons.add('AI_CANNOT_APPROVE_JURISDICTION');
  }

  if (!isKnownJurisdiction(query.jurisdiction)) {
    reasons.add('JURISDICTION_RESEARCH_REQUIRED');
    return finish(query, 'RESEARCH_REQUIRED', reasons, evidenceRefs, missing, 'unknown jurisdiction is unavailable');
  }

  const entity = findLegalEntity(query.legalEntityRef);
  if (!entity || entity.jurisdiction !== query.jurisdiction) {
    reasons.add('LEGAL_ENTITY_MISMATCH');
    return finish(query, 'DISABLED', reasons, evidenceRefs, missing, 'evidence does not bind to this legal-entity reference');
  }

  if (query.corridorId) {
    const corridor = findCorridor(query.corridorId);
    if (!corridor) {
      reasons.add('CORRIDOR_DISABLED');
      return finish(query, 'DISABLED', reasons, evidenceRefs, missing, 'unknown corridor is disabled');
    }
    if (corridor.servingLegalEntityRef !== query.legalEntityRef) {
      reasons.add('LEGAL_ENTITY_MISMATCH');
      reasons.add('CORRIDOR_DISABLED');
      return finish(query, 'DISABLED', reasons, evidenceRefs, missing, 'corridor serving entity does not match');
    }
  }

  const applicable = catalog.evidence.filter(
    (row) =>
      evidenceMatchesEntity(row, query.legalEntityRef) && evidenceCoversDomain(row, query.activationDomain),
  );
  for (const row of applicable) {
    if (row.reference) {
      evidenceRefs.push(row.reference);
    } else {
      evidenceRefs.push(row.evidenceId);
    }
  }

  const requirements = requirementsFor(query.activationDomain);
  let revoked = false;
  let expired = false;
  let engineeringOnly = false;
  let missingLegal = false;
  let humanPresent = false;
  let nonFixtureExternal = false;
  let fixtureExternal = false;

  for (const requirement of requirements) {
    if (requirement.corridorEndpoint && !query.corridorId) {
      continue;
    }
    const corridor = query.corridorId ? findCorridor(query.corridorId) : undefined;
    const matches = applicable.filter((row) => row.evidenceClass === requirement.evidenceClass);
    const scoped = matches.filter((row) => {
      if (!corridor || !requirement.corridorEndpoint) {
        return row.jurisdiction === query.jurisdiction || row.activationDomain === '*';
      }
      if (requirement.corridorEndpoint === 'SOURCE') {
        return row.jurisdiction === corridor.sourceJurisdiction;
      }
      if (requirement.corridorEndpoint === 'DESTINATION') {
        return row.jurisdiction === corridor.destinationJurisdiction;
      }
      return (
        applicable.some((item) => item.jurisdiction === corridor.sourceJurisdiction && item.evidenceClass === requirement.evidenceClass) &&
        applicable.some((item) => item.jurisdiction === corridor.destinationJurisdiction && item.evidenceClass === requirement.evidenceClass)
      );
    });

    if (requirement.corridorEndpoint === 'BOTH' && corridor) {
      const sourceOk = applicable.some(
        (row) =>
          row.evidenceClass === requirement.evidenceClass &&
          row.jurisdiction === corridor.sourceJurisdiction &&
          !evidenceIsRevoked(row) &&
          !evidenceIsExpired(row, nowUtc),
      );
      const destOk = applicable.some(
        (row) =>
          row.evidenceClass === requirement.evidenceClass &&
          row.jurisdiction === corridor.destinationJurisdiction &&
          !evidenceIsRevoked(row) &&
          !evidenceIsExpired(row, nowUtc),
      );
      if (!sourceOk || !destOk) {
        missingLegal = true;
        missing.push(requirement.requirementId);
        reasons.add(reasonCodeForClass(requirement.evidenceClass));
        if (query.activationDomain === 'PAYMENT_RAILS') {
          reasons.add('CORRIDOR_DISABLED');
        }
        continue;
      }
    }

    const record = scoped[0] ?? matches[0];
    if (!record || record.state === 'NOT_PROVIDED' || record.state === 'RESEARCH_REQUIRED') {
      missingLegal = true;
      missing.push(requirement.requirementId);
      reasons.add(reasonCodeForClass(requirement.evidenceClass));
      continue;
    }
    if (evidenceIsRevoked(record)) {
      revoked = true;
      missingLegal = true;
      missing.push(requirement.requirementId);
      reasons.add('EVIDENCE_REVOKED');
      continue;
    }
    if (evidenceIsExpired(record, nowUtc)) {
      expired = true;
      missingLegal = true;
      missing.push(requirement.requirementId);
      reasons.add('EVIDENCE_EXPIRED');
      continue;
    }
    if (fixtureCounselIsInsufficient(record) && requirement.evidenceClass === 'COUNSEL_OPINION') {
      missingLegal = true;
      missing.push(requirement.requirementId);
      reasons.add('COUNSEL_EVIDENCE_MISSING');
      reasons.add('FIXTURE_EVIDENCE_INSUFFICIENT');
      continue;
    }
    if (engineeringTestIsNotLegal(record) && requirement.evidenceClass !== 'ENGINEERING_TEST') {
      engineeringOnly = true;
      missingLegal = true;
      missing.push(requirement.requirementId);
      reasons.add('ENGINEERING_TEST_NOT_LEGAL_APPROVAL');
      reasons.add(reasonCodeForClass(requirement.evidenceClass));
      continue;
    }
    if (record.fixture && requirement.evidenceClass !== 'ENGINEERING_TEST') {
      fixtureExternal = record.state === 'EXTERNALLY_VERIFIED' || record.state === 'PROVIDED_UNVERIFIED';
      missingLegal = true;
      missing.push(requirement.requirementId);
      reasons.add('FIXTURE_EVIDENCE_INSUFFICIENT');
      reasons.add(reasonCodeForClass(requirement.evidenceClass));
      if (requirement.evidenceClass === 'HUMAN_AUTHORIZATION') {
        reasons.add('HUMAN_APPROVAL_REQUIRED');
      }
      continue;
    }
    if (requirement.evidenceClass === 'HUMAN_AUTHORIZATION') {
      if (record.actorKind && NON_HUMAN.has(record.actorKind)) {
        reasons.add('AI_CANNOT_APPROVE_JURISDICTION');
        reasons.add('HUMAN_APPROVAL_REQUIRED');
        missingLegal = true;
        missing.push(requirement.requirementId);
        continue;
      }
      if (record.actorKind !== 'HUMAN' || record.state === 'PROVIDED_UNVERIFIED') {
        reasons.add('HUMAN_APPROVAL_REQUIRED');
        missingLegal = true;
        missing.push(requirement.requirementId);
        continue;
      }
      humanPresent = true;
      continue;
    }
    if (record.state === 'ENGINEERING_VERIFIED') {
      engineeringOnly = true;
      continue;
    }
    if (record.state === 'EXTERNALLY_VERIFIED' && !record.fixture) {
      nonFixtureExternal = true;
      continue;
    }
    if (record.state === 'PROVIDED_UNVERIFIED') {
      missingLegal = true;
      missing.push(requirement.requirementId);
      reasons.add(reasonCodeForClass(requirement.evidenceClass));
    }
  }

  if (query.activationDomain === 'PAYMENT_RAILS') {
    const fx = findProvider('FX_LIQUIDITY');
    const rail = findProvider('PAYMENT_RAIL');
    if (fx && (!rail || !rail.legallyEligible)) {
      reasons.add('FX_EVIDENCE_NOT_PAYMENT_RAIL');
      reasons.add('PROVIDER_NOT_ELIGIBLE');
    }
    if (query.corridorId) {
      const corridor = findCorridor(query.corridorId);
      if (corridor) {
        const sourceEvidence = applicable.filter((row) => row.jurisdiction === corridor.sourceJurisdiction);
        const destEvidence = applicable.filter((row) => row.jurisdiction === corridor.destinationJurisdiction);
        if (sourceEvidence.length === 0 || destEvidence.length === 0) {
          reasons.add('CORRIDOR_DISABLED');
          missingLegal = true;
        }
      }
    }
  }

  const providers = catalog.providers.filter((row) => row.legalEntityRef === query.legalEntityRef);
  if (providers.some((row) => row.engineeringHealthy && !row.legallyEligible)) {
    reasons.add('ENGINEERING_TEST_NOT_LEGAL_APPROVAL');
    reasons.add('PROVIDER_NOT_ELIGIBLE');
  }

  if (query.activationDomain === 'HUMAN_INFORMATION_MARKET') {
    const hinClasses = ['PRIVACY_REVIEW', 'DATA_RESIDENCY', 'CONSENT_CONTROL', 'PURPOSE_CONTROL', 'TERMS_AGREEMENT'] as const;
    for (const cls of hinClasses) {
      const found = applicable.find((row) => row.evidenceClass === cls && !row.fixture && row.state === 'EXTERNALLY_VERIFIED');
      if (!found) {
        reasons.add(reasonCodeForClass(cls));
        missingLegal = true;
      }
    }
  }

  if (query.activationDomain === 'PRODUCTIVE_CAPACITY_MARKET') {
    const found = applicable.find(
      (row) => row.evidenceClass === 'JURISDICTIONAL_USE_RIGHT' && !row.fixture && row.state === 'EXTERNALLY_VERIFIED',
    );
    if (!found) {
      reasons.add('DATA_RIGHTS_EVIDENCE_MISSING');
      missingLegal = true;
    }
  }

  if (revoked) {
    status = 'REVOKED';
  } else if (expired) {
    status = 'EXPIRED';
  } else if (missingLegal && applicable.length === 0) {
    status = 'RESEARCH_REQUIRED';
  } else if (missingLegal && engineeringOnly) {
    status = 'ENGINEERING_READY';
  } else if (missingLegal && fixtureExternal) {
    status = 'HUMAN_APPROVAL_REQUIRED';
    reasons.add('HUMAN_APPROVAL_REQUIRED');
  } else if (missingLegal) {
    status = 'EVIDENCE_REQUIRED';
  } else if (nonFixtureExternal && !humanPresent) {
    status = 'HUMAN_APPROVAL_REQUIRED';
    reasons.add('HUMAN_APPROVAL_REQUIRED');
  } else if (nonFixtureExternal && humanPresent && query.actorKind && NON_HUMAN.has(query.actorKind)) {
    status = 'HUMAN_APPROVAL_REQUIRED';
    reasons.add('AI_CANNOT_APPROVE_JURISDICTION');
  } else if (nonFixtureExternal && humanPresent && !query.twinOverlay) {
    status = 'ELIGIBLE_CANDIDATE';
  } else if (query.twinOverlay) {
    status = 'UNDER_REVIEW';
  } else {
    status = 'EVIDENCE_REQUIRED';
  }

  const notes =
    status === 'ELIGIBLE_CANDIDATE'
      ? 'eligible candidate for a human to consider; production remains inactive; Kernel still decides'
      : 'operating scope is not live-enabled; this is not a legal conclusion';

  return finish(query, status, reasons, evidenceRefs, missing, notes);
}

export function toOperatingScopeFact(evaluation: OperatingScopeEvaluation): OperatingScopeFact {
  return Object.freeze({
    schemaVersion: 1,
    jurisdiction: evaluation.key.jurisdiction,
    activationDomain: evaluation.key.activationDomain,
    legalEntityRef: evaluation.key.legalEntityRef,
    eligibility: evaluation.eligible,
    status: evaluation.status,
    reasonCodes: evaluation.reasonCodes,
    evidenceReferences: evaluation.evidenceReferences,
    productionActive: false,
    createsExecutionAuthority: false,
    confirmedByCounsel: false,
  });
}

export function simulateScopeChange(
  query: OperatingScopeQuery,
  catalog: OperatingScopeCatalog,
  overlayEvidence: readonly ScopeEvidenceRecord[],
): OperatingScopeEvaluation {
  const sanitized = overlayEvidence.map((row) => {
    if (row.state === 'EXTERNALLY_VERIFIED') {
      return Object.freeze({
        ...row,
        state: 'PROVIDED_UNVERIFIED' as const,
        notes: `${row.notes}; twin overlay cannot mark EXTERNALLY_VERIFIED`,
      });
    }
    return row;
  });
  const merged: OperatingScopeCatalog = Object.freeze({
    ...catalog,
    evidence: Object.freeze([...catalog.evidence, ...sanitized]),
  });
  return evaluateOperatingScope({ ...query, twinOverlay: true }, merged);
}

export function domainEvaluationDoesNotAuthorize(
  source: OperatingScopeEvaluation,
  targetDomain: ActivationDomain,
): boolean {
  if (source.key.activationDomain === targetDomain) {
    return true;
  }
  return !source.eligible || source.key.activationDomain !== targetDomain;
}

function finish(
  query: OperatingScopeQuery,
  status: OperatingScopeStatus,
  reasons: Set<OperatingScopeReasonCode>,
  evidenceRefs: readonly string[],
  missing: readonly string[],
  notes: string,
): OperatingScopeEvaluation {
  const eligible = status === 'ELIGIBLE_CANDIDATE';
  return Object.freeze({
    key: Object.freeze({
      jurisdiction: query.jurisdiction,
      activationDomain: query.activationDomain,
      legalEntityRef: query.legalEntityRef,
      ...(query.customerClass ? { customerClass: query.customerClass } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.corridorId ? { corridorId: query.corridorId } : {}),
      ...(query.asset ? { asset: query.asset } : {}),
    }),
    status,
    eligible,
    available: eligible,
    reasonCodes: Object.freeze([...reasons]),
    evidenceReferences: Object.freeze([...new Set(evidenceRefs)]),
    missingRequirements: Object.freeze([...missing]),
    productionActive: false,
    createsExecutionAuthority: false,
    confirmedByCounsel: false,
    engineeringTestUsedAsLegalApproval: false,
    notes,
  });
}
