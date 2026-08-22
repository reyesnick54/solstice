import type { UtcInstant } from '../../../../domain/src/time.ts';
import { createFinding } from './findings.ts';
import type { ComplianceAdapterStore } from './store.ts';
import {
  stricterMatchState,
  type ComplianceAdapterProfile,
  type NormalizedComplianceFinding,
  type ProviderMatchState,
  type ScreeningSubject,
} from './types.ts';

export type PepScreenInput = {
  readonly subjectKind: ScreeningSubject;
  readonly subjectRef: string;
  readonly relatedPersonRef?: string;
  readonly now: UtcInstant;
};

export type PepProviderPort = {
  screen(input: PepScreenInput): NormalizedComplianceFinding;
};

export class PepAdapter implements PepProviderPort {
  readonly #store: ComplianceAdapterStore;
  readonly #profile: ComplianceAdapterProfile;
  readonly #matchFor: (subjectRef: string) => ProviderMatchState;

  constructor(
    store: ComplianceAdapterStore,
    profile: ComplianceAdapterProfile,
    matchFor: (subjectRef: string) => ProviderMatchState,
  ) {
    this.#store = store;
    this.#profile = profile;
    this.#matchFor = matchFor;
  }

  screen(input: PepScreenInput): NormalizedComplianceFinding {
    const subjectMatch = this.#matchFor(input.subjectRef);
    const matchState = input.relatedPersonRef
      ? stricterMatchState(subjectMatch, this.#matchFor(input.relatedPersonRef))
      : subjectMatch;
    const finding = createFinding({
      kind: 'PEP',
      subjectKind: input.subjectKind,
      subjectRef: input.subjectRef,
      providerId: this.#profile.providerId,
      matchState,
      severity: matchState === 'NO_MATCH' ? 'INFO' : 'MEDIUM',
      reasonCodes: Object.freeze([
        `PEP_${matchState}`,
        ...(input.relatedPersonRef ? (['RELATED_PERSON_SCREENED'] as const) : []),
      ]),
      now: input.now,
    });
    this.#store.findings.set(finding.findingId, finding);
    return finding;
  }
}
