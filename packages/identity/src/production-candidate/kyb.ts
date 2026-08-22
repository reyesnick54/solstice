import { randomUUID } from 'node:crypto';

import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { IdentityAdapterStore } from './store.ts';
import type { IdentityAdapterProfile, KybRecord, KybVerificationState } from './types.ts';

export type StartKybInput = {
  readonly businessId: string;
  readonly registrationRef: string | null;
  readonly jurisdiction: Jurisdiction;
  readonly now: UtcInstant;
  readonly beneficialOwnerRefs?: readonly string[];
  readonly directorRefs?: readonly string[];
  readonly documentRefs?: readonly string[];
};

export type KybProviderPort = {
  startBusinessVerification(input: StartKybInput): KybRecord;
  retrieveBusinessVerification(kybId: string): KybRecord | undefined;
  refreshBusinessMonitoring(input: { readonly kybId: string; readonly now: UtcInstant }): KybRecord;
};

export class KybAdapter implements KybProviderPort {
  readonly #store: IdentityAdapterStore;
  readonly #profile: IdentityAdapterProfile;
  readonly #stateFor: (businessId: string) => KybVerificationState;

  constructor(
    store: IdentityAdapterStore,
    profile: IdentityAdapterProfile,
    stateFor: (businessId: string) => KybVerificationState,
  ) {
    this.#store = store;
    this.#profile = profile;
    this.#stateFor = stateFor;
  }

  startBusinessVerification(input: StartKybInput): KybRecord {
    const state = this.#stateFor(input.businessId);
    const record: KybRecord = Object.freeze({
      kybId: `kyb_${randomUUID()}`,
      businessId: input.businessId,
      registrationRef: input.registrationRef,
      jurisdiction: input.jurisdiction,
      state,
      providerRef: `${this.#profile.providerId}:kyb:${input.businessId}`,
      beneficialOwnerRefs: Object.freeze([...(input.beneficialOwnerRefs ?? [])]),
      directorRefs: Object.freeze([...(input.directorRefs ?? [])]),
      documentRefs: Object.freeze([...(input.documentRefs ?? [])]),
      businessRisk: state === 'FAILED' ? 'HIGH' : state === 'REQUIRES_REVIEW' ? 'ELEVATED' : 'STANDARD',
      ongoingMonitoring: true,
      reasonCodes: Object.freeze(state === 'VERIFIED' ? ['BUSINESS_VERIFIED'] : [state]),
      evidenceRefs: Object.freeze([`kyb-ev:${input.businessId}`]),
      observedAt: input.now,
      isIndividualKyc: false,
    });
    this.#store.kyb.set(record.kybId, record);
    return record;
  }

  retrieveBusinessVerification(kybId: string): KybRecord | undefined {
    return this.#store.kyb.get(kybId);
  }

  refreshBusinessMonitoring(input: { readonly kybId: string; readonly now: UtcInstant }): KybRecord {
    const current = this.#store.kyb.get(input.kybId);
    if (!current) {
      throw new Error(`unknown KYB record ${input.kybId}`);
    }
    const next: KybRecord = Object.freeze({
      ...current,
      observedAt: input.now,
      ongoingMonitoring: true,
      reasonCodes: Object.freeze([...current.reasonCodes, 'BUSINESS_STATUS_REFRESHED']),
    });
    this.#store.kyb.set(next.kybId, next);
    return next;
  }
}
