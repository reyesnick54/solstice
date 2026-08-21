import type { UtcInstant } from '../../../../domain/src/time.ts';
import { createFinding } from './findings.ts';
import type { ComplianceAdapterStore } from './store.ts';
import type {
  ComplianceAdapterProfile,
  NormalizedComplianceFinding,
  ProviderMatchState,
  ScreeningSubject,
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
  constructor(
    private readonly store: ComplianceAdapterStore,
    private readonly profile: ComplianceAdapterProfile,
    private readonly matchFor: (subjectRef: string) => ProviderMatchState,
  ) {}

  screen(input: PepScreenInput): NormalizedComplianceFinding {
    const matchState = this.matchFor(input.relatedPersonRef ?? input.subjectRef);
    const finding = createFinding({
      kind: 'PEP',
      subjectKind: input.subjectKind,
      subjectRef: input.subjectRef,
      providerId: this.profile.providerId,
      matchState,
      severity: matchState === 'NO_MATCH' ? 'INFO' : 'MEDIUM',
      reasonCodes: Object.freeze([
        `PEP_${matchState}`,
        ...(input.relatedPersonRef ? (['RELATED_PERSON_SCREENED'] as const) : []),
      ]),
      now: input.now,
    });
    this.store.findings.set(finding.findingId, finding);
    return finding;
  }
}
