import { createHash } from 'node:crypto';

import { err, ok, type Result } from '@solstice/domain';
import {
  evaluatePurposeCompatibility,
  type EvidenceVault,
  type PersonalDataCategory,
  type SealedEvidence,
} from '@solstice/kernel';
import type { ConsentLedger } from '../consent/ledger.ts';
import type { ConsentRecord } from '../consent/types.ts';
import {
  parseAccessRequest,
  type AccessRequest,
  type AccessRequestRejection,
} from './access-request.ts';

export type PurposeAuthorization = {
  readonly __brand: 'PurposeAuthorization';
  readonly accessId: string;
  readonly category: PersonalDataCategory;
  readonly purpose: AccessRequest['purpose'];
  readonly requesterId: string;
  readonly sessionId: string;
  readonly consentRefs: readonly { readonly consentId: string; readonly versionNumber: number }[];
  readonly evidenceId: string;
};

export type FirewallDenial = {
  readonly code:
    | 'INCOMPLETE_ACCESS_REQUEST'
    | 'CROSS_CATEGORY_REQUEST'
    | 'PURPOSE_INCOMPATIBLE'
    | 'CONSENT_MISSING'
    | 'CONSENT_REVOKED'
    | 'CONSENT_EXPIRED'
    | 'FORBIDDEN_DATA_CATEGORY'
    | 'AGENT_CONSENT_FORBIDDEN';
  readonly reasons: readonly string[];
  readonly missingFields?: readonly string[];
  readonly evidence: SealedEvidence;
};

export type CapabilityView = {
  readonly forbiddenDataCategories: readonly string[];
};

/**
 * Purpose Firewall — the only backend authorization for vault/clean-room access.
 *
 * A valid session is not sufficient. Purpose compatibility is a matrix in
 * this module and in the Kernel PURPOSE proof, not a prompt convention.
 */
export class PurposeFirewall {
  readonly #vault: EvidenceVault;
  readonly #consent: ConsentLedger;

  constructor(evidence: EvidenceVault, consent: ConsentLedger) {
    this.#vault = evidence;
    this.#consent = consent;
  }

  authorize(input: {
    readonly request: unknown;
    readonly now: string;
    readonly subjectRefs: readonly string[];
    readonly capability?: CapabilityView;
    readonly sessionValid: boolean;
  }): Result<PurposeAuthorization, FirewallDenial> {
    const parsed = parseAccessRequest(input.request);
    if (!parsed.ok) {
      return err(this.deny(parsed.error, input.now, input.request));
    }
    const request = parsed.value;
    const category = request.dataCategories[0]!;

    if (request.requester.kind === 'AGENT') {
      const evidence = this.seal(input.now, 'data_access.denied', {
        reason: 'AGENT_CONSENT_FORBIDDEN',
        requesterKind: 'AGENT',
        purpose: request.purpose,
        category,
        requestHash: hashUnknown(input.request),
      });
      return err({
        code: 'AGENT_CONSENT_FORBIDDEN',
        reasons: Object.freeze([
          'agent principals cannot access the vault or grant, modify, or revoke consent',
        ]),
        evidence,
      });
    }

    if (input.capability?.forbiddenDataCategories.includes(category)) {
      const evidence = this.seal(input.now, 'data_access.denied', {
        reason: 'FORBIDDEN_DATA_CATEGORY',
        category,
        purpose: request.purpose,
        requesterId: request.requester.id,
        sessionValid: input.sessionValid,
        requestHash: hashUnknown(input.request),
      });
      return err({
        code: 'FORBIDDEN_DATA_CATEGORY',
        reasons: Object.freeze([
          `capability token forbids category ${category}; session validity does not override`,
        ]),
        evidence,
      });
    }

    const compatibility = evaluatePurposeCompatibility(category, request.purpose);
    if (!compatibility.allowed) {
      const evidence = this.seal(input.now, 'data_access.denied', {
        reason: 'PURPOSE_INCOMPATIBLE',
        category,
        purpose: request.purpose,
        requesterId: request.requester.id,
        sessionValid: input.sessionValid,
        sessionIdHash: sha256(request.requester.sessionId),
        requestHash: hashUnknown(input.request),
      });
      return err({
        code: 'PURPOSE_INCOMPATIBLE',
        reasons: compatibility.reasons,
        evidence,
      });
    }

    const consent = this.#consent.activeConsentFor(request, input.subjectRefs, input.now);
    if (!consent.ok) {
      const code = consent.reason.includes('revoked')
        ? 'CONSENT_REVOKED'
        : consent.reason.includes('expired')
          ? 'CONSENT_EXPIRED'
          : 'CONSENT_MISSING';
      const evidence = this.seal(input.now, 'data_access.denied', {
        reason: code,
        category,
        purpose: request.purpose,
        requesterId: request.requester.id,
        sessionValid: input.sessionValid,
        detail: consent.reason,
        requestHash: hashUnknown(input.request),
      });
      return err({
        code,
        reasons: Object.freeze([consent.reason]),
        evidence,
      });
    }

    const accessId = `acc_${sha256(`${request.requester.id}:${category}:${request.purpose}:${input.now}`).slice(0, 16)}`;
    const evidence = this.seal(input.now, 'data_access.granted', {
      accessId,
      category,
      purpose: request.purpose,
      requesterId: request.requester.id,
      sessionValid: input.sessionValid,
      sessionIdHash: sha256(request.requester.sessionId),
      consentRefs: consent.consents.map((row) => ({
        consentId: row.consentId,
        versionNumber: row.versionNumber,
      })),
      subjectCount: input.subjectRefs.length,
      requestHash: hashUnknown(input.request),
    });

    return ok(
      Object.freeze({
        __brand: 'PurposeAuthorization',
        accessId,
        category,
        purpose: request.purpose,
        requesterId: request.requester.id,
        sessionId: request.requester.sessionId,
        consentRefs: Object.freeze(
          consent.consents.map((row: ConsentRecord) =>
            Object.freeze({ consentId: row.consentId, versionNumber: row.versionNumber }),
          ),
        ),
        evidenceId: evidence.id,
      }),
    );
  }

  private deny(
    rejection: AccessRequestRejection,
    now: string,
    request: unknown,
  ): FirewallDenial {
    const evidence = this.seal(now, 'data_access.denied', {
      reason: rejection.code,
      missingFields: rejection.missingFields,
      reasons: rejection.reasons,
      requestHash: hashUnknown(request),
    });
    return {
      code: rejection.code,
      reasons: rejection.reasons,
      missingFields: rejection.missingFields,
      evidence,
    };
  }

  private seal(now: string, kind: string, payload: Record<string, unknown>): SealedEvidence {
    return this.#vault.seal({ kind, ...payload }, now as never);
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hashUnknown(value: unknown): string {
  return sha256(JSON.stringify(value ?? null));
}
