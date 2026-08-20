/**
 * Governance evidence for parameter candidates.
 *
 * Reuses existing mainnet authorization roles and protocol governance
 * references. A boolean `governed: true` is never sufficient by itself.
 * AI / S3M / Grok / agents / automation / model output cannot authorize.
 */

import { AUTHORIZATION_ROLES } from '../../../mainnet/types.ts';
import { GOVERNANCE_ROLES } from '../../../governance/types.ts';
import { GOVERNANCE_REFERENCE } from '../../constitution.ts';

import {
  REJECTED_PARAMETER_AUTHORIZERS,
  type ParameterBlockingCode,
  type ParameterGovernanceEvidenceRef,
} from './types.ts';

export const PARAMETER_GOVERNANCE_REFERENCE = GOVERNANCE_REFERENCE;

export const CANONICAL_PARAMETER_GOVERNANCE_ROLES = Object.freeze([
  ...AUTHORIZATION_ROLES,
  ...GOVERNANCE_ROLES.filter((role) => role !== 'AI_PREPARER'),
]);

export function actorIsRejectedAuthorizer(actorKind: string): boolean {
  const normalized = actorKind.trim().toUpperCase();
  return (REJECTED_PARAMETER_AUTHORIZERS as readonly string[]).includes(normalized);
}

export function rejectAiParameterApproval(actorKind: string): ParameterBlockingCode | null {
  if (actorIsRejectedAuthorizer(actorKind)) {
    return 'AI_CANNOT_AUTHORIZE_PARAMETER';
  }
  return null;
}

export function governanceEvidenceUsable(
  evidence: ParameterGovernanceEvidenceRef,
): { readonly ok: boolean; readonly code: ParameterBlockingCode | null } {
  if (evidence.fixture) {
    return { ok: false, code: 'FIXTURE_NOT_PRODUCTION_GOVERNANCE' };
  }
  const ai = rejectAiParameterApproval(evidence.actorKind);
  if (ai) {
    return { ok: false, code: ai };
  }
  if (evidence.actorKind !== 'HUMAN' && evidence.evidenceClass !== 'EXTERNAL') {
    return { ok: false, code: 'AI_CANNOT_AUTHORIZE_PARAMETER' };
  }
  if (!evidence.reference || !evidence.contentHash) {
    return { ok: false, code: 'GOVERNANCE_EVIDENCE_MISSING' };
  }
  if (evidence.evidenceClass === 'HUMAN' && evidence.actorKind !== 'HUMAN') {
    return { ok: false, code: 'AI_CANNOT_AUTHORIZE_PARAMETER' };
  }
  return { ok: true, code: null };
}

export function collectAuthorizationFailures(
  evidence: readonly ParameterGovernanceEvidenceRef[],
): ParameterBlockingCode[] {
  const codes: ParameterBlockingCode[] = [];
  for (const row of evidence) {
    const judged = governanceEvidenceUsable(row);
    if (!judged.ok && judged.code && !codes.includes(judged.code)) {
      codes.push(judged.code);
    }
  }
  return codes;
}

export function humanEvidencePresent(evidence: readonly ParameterGovernanceEvidenceRef[]): boolean {
  return evidence.some((row) => row.evidenceClass === 'HUMAN' && governanceEvidenceUsable(row).ok);
}

export function protocolEvidencePresent(evidence: readonly ParameterGovernanceEvidenceRef[]): boolean {
  return evidence.some((row) => row.evidenceClass === 'PROTOCOL' && governanceEvidenceUsable(row).ok);
}

export function externalEvidencePresent(evidence: readonly ParameterGovernanceEvidenceRef[]): boolean {
  return evidence.some((row) => row.evidenceClass === 'EXTERNAL' && governanceEvidenceUsable(row).ok);
}

export function booleanGovernedInsufficient(): ParameterBlockingCode {
  return 'BOOLEAN_GOVERNED_INSUFFICIENT';
}
