import type { UtcInstant } from '../../../../domain/src/time.ts';
import { createFinding } from './findings.ts';
import type { ComplianceAdapterStore } from './store.ts';
import type {
  ComplianceAdapterProfile,
  NormalizedComplianceFinding,
  ProviderMatchState,
  ScreeningSubject,
} from './types.ts';

export type SanctionsScreenInput = {
  readonly subjectKind: ScreeningSubject;
  readonly subjectRef: string;
  readonly now: UtcInstant;
};

export type SanctionsProviderPort = {
  screen(input: SanctionsScreenInput): NormalizedComplianceFinding;
};

export class SanctionsAdapter implements SanctionsProviderPort {
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

  screen(input: SanctionsScreenInput): NormalizedComplianceFinding {
    if (this.#profile.health === 'UNAVAILABLE') {
      const finding = createFinding({
        kind: 'SANCTIONS',
        subjectKind: input.subjectKind,
        subjectRef: input.subjectRef,
        providerId: this.#profile.providerId,
        matchState: 'UNAVAILABLE',
        severity: 'HIGH',
        reasonCodes: ['PROVIDER_UNAVAILABLE'],
        now: input.now,
      });
      this.#store.findings.set(finding.findingId, finding);
      return finding;
    }
    const matchState = this.#matchFor(input.subjectRef);
    const finding = createFinding({
      kind: 'SANCTIONS',
      subjectKind: input.subjectKind,
      subjectRef: input.subjectRef,
      providerId: this.#profile.providerId,
      matchState,
      severity: matchState === 'CONFIRMED_MATCH' ? 'CRITICAL' : matchState === 'POSSIBLE_MATCH' ? 'HIGH' : 'INFO',
      reasonCodes: Object.freeze([`SANCTIONS_${matchState}`]),
      now: input.now,
    });
    this.#store.findings.set(finding.findingId, finding);
    return finding;
  }
}
