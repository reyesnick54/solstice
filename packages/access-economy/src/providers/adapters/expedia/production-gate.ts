/**
 * Expedia production commercial gate — code completion does not satisfy these.
 */

export const EXPEDIA_PRODUCTION_GATE_REQUIREMENTS = [
  'SIGNED_PROVIDER_AGREEMENT',
  'COMMERCIAL_TERMS',
  'REFUND_POLICY',
  'SERVICE_LEVEL_EXPECTATIONS',
  'PRIVACY_REVIEW',
  'SECURITY_REVIEW',
  'LEGAL_JURISDICTION_REVIEW',
  'PAYMENT_CUSTODY_LICENSE_ANALYSIS',
  'PRODUCTION_CREDENTIALS',
  'OPERATIONAL_MONITORING',
] as const;

export type ExpediaProductionGateRequirement = (typeof EXPEDIA_PRODUCTION_GATE_REQUIREMENTS)[number];

export type ExpediaProductionGateChecklist = {
  readonly providerId: 'expedia';
  readonly requirements: readonly {
    readonly requirement: ExpediaProductionGateRequirement;
    readonly satisfied: false;
    readonly notes: string;
  }[];
  readonly liveEnabled: false;
  readonly sandboxAvailable: true;
};

export function expediaProductionGateChecklist(): ExpediaProductionGateChecklist {
  return Object.freeze({
    providerId: 'expedia',
    requirements: Object.freeze(
      EXPEDIA_PRODUCTION_GATE_REQUIREMENTS.map((requirement) =>
        Object.freeze({
          requirement,
          satisfied: false as const,
          notes: 'commercial and operational evidence required; credentials alone are insufficient',
        }),
      ),
    ),
    liveEnabled: false,
    sandboxAvailable: true,
  });
}

export function canEnableExpediaLive(_checklist: ExpediaProductionGateChecklist): boolean {
  return false;
}
