import type { UtcInstant } from '../../../../domain/src/time.ts';
import { createFinding } from './findings.ts';
import type { ComplianceAdapterStore } from './store.ts';
import type {
  ComplianceAdapterProfile,
  NormalizedComplianceFinding,
  ProviderMatchState,
  ScreeningSubject,
} from './types.ts';

export type AdverseMediaScreenInput = {
  readonly subjectKind: ScreeningSubject;
  readonly subjectRef: string;
  readonly now: UtcInstant;
};

export type AdverseMediaProviderPort = {
  screen(input: AdverseMediaScreenInput): NormalizedComplianceFinding;
};

export class AdverseMediaAdapter implements AdverseMediaProviderPort {
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

  screen(input: AdverseMediaScreenInput): NormalizedComplianceFinding {
    const matchState = this.#matchFor(input.subjectRef);
    const finding = createFinding({
      kind: 'ADVERSE_MEDIA',
      subjectKind: input.subjectKind,
      subjectRef: input.subjectRef,
      providerId: this.#profile.providerId,
      matchState,
      severity: matchState === 'NO_MATCH' ? 'INFO' : 'MEDIUM',
      reasonCodes: Object.freeze([`ADVERSE_MEDIA_${matchState}`]),
      now: input.now,
    });
    this.#store.findings.set(finding.findingId, finding);
    return finding;
  }
}
