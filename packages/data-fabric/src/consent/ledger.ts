import {
  assertKernelAuthorization,
  type KernelAuthorization,
  type DataPurpose,
  type PersonalDataCategory,
} from '@solstice/kernel';

import type { AccessRequest } from '../purpose/access-request.ts';
import type { ConsentGrantInput, ConsentModifyInput, ConsentRecord } from './types.ts';

/**
 * Append-only, versioned consent ledger.
 *
 * Grant, modify, and revoke each require a KernelAuthorization for the
 * matching ActionIntent. A change creates a new version; prior versions
 * are never edited. Expiry is evaluated at access time — no sweep job.
 */
export class ConsentLedger {
  readonly #versions: ConsentRecord[] = [];

  list(): readonly ConsentRecord[] {
    return this.#versions.slice();
  }

  latest(consentId: string): ConsentRecord | undefined {
    const matches = this.#versions.filter((row) => row.consentId === consentId);
    return matches.at(-1);
  }

  /** @kernelGated */
  appendConsentGrant(authorization: KernelAuthorization, input: ConsentGrantInput): ConsentRecord {
    assertKernelAuthorization(authorization, 'GRANT_CONSENT');
    const record: ConsentRecord = Object.freeze({
      ...input,
      dataCategories: Object.freeze([...input.dataCategories]),
      compensation: Object.freeze({ ...input.compensation }),
      status: 'ACTIVE',
      versionNumber: 1,
      priorVersionNumber: null,
    });
    this.#versions.push(record);
    return record;
  }

  /** @kernelGated */
  appendConsentModification(
    authorization: KernelAuthorization,
    input: ConsentModifyInput,
  ): ConsentRecord {
    assertKernelAuthorization(authorization, 'MODIFY_CONSENT');
    const current = this.latest(input.consentId);
    if (!current) {
      throw new Error(`consent ${input.consentId} not found`);
    }
    if (current.status === 'REVOKED') {
      throw new Error(`consent ${input.consentId} is revoked and cannot be modified`);
    }
    const superseded: ConsentRecord = Object.freeze({
      ...current,
      status: 'SUPERSEDED',
    });
    this.#versions.push(superseded);
    const next: ConsentRecord = Object.freeze({
      ...current,
      ...input.changes,
      dataCategories: Object.freeze([
        ...(input.changes.dataCategories ?? current.dataCategories),
      ]),
      compensation: Object.freeze({
        ...(input.changes.compensation ?? current.compensation),
      }),
      status: 'ACTIVE',
      versionNumber: current.versionNumber + 1,
      priorVersionNumber: current.versionNumber,
    });
    this.#versions.push(next);
    return next;
  }

  /** @kernelGated */
  appendConsentRevocation(
    authorization: KernelAuthorization,
    consentId: string,
  ): ConsentRecord {
    assertKernelAuthorization(authorization, 'REVOKE_CONSENT');
    const current = this.latest(consentId);
    if (!current) {
      throw new Error(`consent ${consentId} not found`);
    }
    const superseded: ConsentRecord = Object.freeze({
      ...current,
      status: 'SUPERSEDED',
    });
    this.#versions.push(superseded);
    const revoked: ConsentRecord = Object.freeze({
      ...current,
      status: 'REVOKED',
      versionNumber: current.versionNumber + 1,
      priorVersionNumber: current.versionNumber,
    });
    this.#versions.push(revoked);
    return revoked;
  }

  /**
   * Access-time evaluation. Expired consent is unusable without a sweep.
   * Revocation of the latest version blocks immediately.
   */
  activeConsentFor(
    request: AccessRequest,
    subjectRefs: readonly string[],
    now: string,
  ): { readonly ok: true; readonly consents: readonly ConsentRecord[] } | { readonly ok: false; readonly reason: string } {
    const category = request.dataCategories[0];
    if (category === undefined) {
      return { ok: false, reason: 'access request has no category' };
    }
    const matched: ConsentRecord[] = [];
    for (const subjectRef of subjectRefs) {
      const latest = this.latestMatching(
        subjectRef,
        request.requester.id,
        request.purpose,
        category,
      );
      if (!latest) {
        return {
          ok: false,
          reason: `no active consent for subject ${hashRef(subjectRef)} requester ${request.requester.id} purpose ${request.purpose} category ${category}`,
        };
      }
      if (latest.status === 'REVOKED') {
        return { ok: false, reason: `consent ${latest.consentId} is revoked` };
      }
      if (Date.parse(now) >= Date.parse(latest.expiry)) {
        return {
          ok: false,
          reason: `consent ${latest.consentId} expired at ${latest.expiry} (evaluated at access time)`,
        };
      }
      if (Date.parse(now) < Date.parse(latest.start)) {
        return { ok: false, reason: `consent ${latest.consentId} has not started` };
      }
      matched.push(latest);
    }
    return { ok: true, consents: Object.freeze(matched) };
  }

  latestMatching(
    subjectRef: string,
    requesterId: string,
    purpose: DataPurpose,
    category: PersonalDataCategory,
  ): ConsentRecord | undefined {
    const matches = this.#versions.filter(
      (row) =>
        row.subjectRef === subjectRef &&
        row.requesterId === requesterId &&
        row.purpose === purpose &&
        row.dataCategories.includes(category),
    );
    const latestById = new Map<string, ConsentRecord>();
    for (const row of matches) {
      const prev = latestById.get(row.consentId);
      if (!prev || row.versionNumber > prev.versionNumber) {
        latestById.set(row.consentId, row);
      }
    }
    const candidates = [...latestById.values()];
    const active = candidates.filter((row) => row.status === 'ACTIVE');
    if (active.length > 0) {
      return active.at(-1);
    }
    return candidates.at(-1);
  }
}

function hashRef(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
}
