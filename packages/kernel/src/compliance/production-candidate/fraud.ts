import { createFinding } from './findings.ts';
import type { ComplianceAdapterStore } from './store.ts';
import type {
  ComplianceAdapterProfile,
  FraudProviderResult,
  FraudRecommendedAction,
  FraudSignalInput,
} from './types.ts';

export type FraudProviderPort = {
  evaluate(input: FraudSignalInput): FraudProviderResult;
};

export class FraudAdapter implements FraudProviderPort {
  readonly #store: ComplianceAdapterStore;
  readonly #profile: ComplianceAdapterProfile;
  readonly #actionFor: (subjectRef: string) => FraudRecommendedAction;

  constructor(
    store: ComplianceAdapterStore,
    profile: ComplianceAdapterProfile,
    actionFor: (subjectRef: string) => FraudRecommendedAction,
  ) {
    this.#store = store;
    this.#profile = profile;
    this.#actionFor = actionFor;
  }

  evaluate(input: FraudSignalInput): FraudProviderResult {
    const recommendedAction = this.#actionFor(input.subjectRef);
    const riskCategory =
      recommendedAction === 'BLOCK' || recommendedAction === 'HOLD'
        ? 'HIGH'
        : recommendedAction === 'REVIEW' || recommendedAction === 'STEP_UP'
          ? 'ELEVATED'
          : 'LOW';
    const finding = createFinding({
      kind: 'FRAUD',
      subjectKind: 'PERSON',
      subjectRef: input.subjectRef,
      providerId: this.#profile.providerId,
      matchState: recommendedAction === 'ALLOW' ? 'NO_MATCH' : 'REQUIRES_REVIEW',
      severity: riskCategory === 'HIGH' ? 'HIGH' : riskCategory === 'ELEVATED' ? 'MEDIUM' : 'INFO',
      reasonCodes: Object.freeze([
        `FRAUD_${recommendedAction}`,
        ...(input.accountBehavior === 'HIGH_VELOCITY' ? (['ACCOUNT_BEHAVIOR_HIGH_VELOCITY'] as const) : []),
        ...(input.cardAuthorizationRef ? (['CARD_AUTHORIZATION_SIGNAL'] as const) : []),
        ...(input.deviceRef ? (['DEVICE_SIGNAL'] as const) : []),
      ]),
      score: riskCategory === 'HIGH' ? 90 : riskCategory === 'ELEVATED' ? 60 : 10,
      recommendedAction,
      now: input.now,
    });
    this.#store.findings.set(finding.findingId, finding);
    return Object.freeze({
      riskScore: finding.score,
      riskCategory,
      reasonCodes: finding.reasonCodes,
      recommendedAction,
      finding,
    });
  }
}
