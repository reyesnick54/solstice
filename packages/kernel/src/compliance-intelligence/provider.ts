/**
 * Compliance intelligence provider port — returns evidence only.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ComplianceEvidence,
  ComplianceEvidenceClassification,
  ComplianceScreeningQuery,
  ComplianceScreeningResult,
  ComplianceSubjectType,
} from './types.ts';

export const COMPLIANCE_INTELLIGENCE_CAPABILITIES = [
  'sanctions',
  'pep_screening',
  'watchlists',
  'wanted_persons',
  'adverse_regulatory_data',
  'public_enforcement_data',
  'entity_resolution',
] as const;
export type ComplianceIntelligenceCapability = (typeof COMPLIANCE_INTELLIGENCE_CAPABILITIES)[number];

export type ComplianceIntelligenceProviderHealth = {
  readonly providerId: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly rateLimited: boolean;
  readonly lastSuccessAt: UtcInstant | null;
  readonly message: string | null;
};

export type ComplianceIntelligenceProvider = {
  readonly providerId: string;
  readonly capabilities: readonly ComplianceIntelligenceCapability[];
  readonly priority: 'primary' | 'secondary' | 'fallback';
  readonly supportedClassifications: readonly ComplianceEvidenceClassification[];
  readonly supportedSubjectTypes: readonly ComplianceSubjectType[];
  readonly productionAuthorized: boolean;
  readonly liveProviderConnected: false;

  health(nowUtc: UtcInstant): ComplianceIntelligenceProviderHealth;
  screenPerson(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult>;
  screenOrganization(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult>;
  searchEntity(query: ComplianceScreeningQuery): Promise<ComplianceScreeningResult>;
  getRecord(providerRecordId: string, nowUtc: UtcInstant): Promise<ComplianceScreeningResult | null>;
};

export function providerSupportsClassification(
  provider: ComplianceIntelligenceProvider,
  classification: ComplianceEvidenceClassification,
): boolean {
  return (provider.supportedClassifications as readonly string[]).includes(classification);
}
