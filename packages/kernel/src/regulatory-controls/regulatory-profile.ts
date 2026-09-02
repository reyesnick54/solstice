/**
 * Wave 7 — Configurable RegulatoryControlProfile objects.
 *
 * Technical requirement structures for regulatory categories.
 * Not legal conclusions — legalStatus remains RESEARCH_REQUIRED.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import { LEGAL_REVIEW_STATUS, type RegulatoryCategory } from './taxonomy.ts';
import type { RegulatoryControlProfile, RegulatoryControlRequirement } from './types.ts';

function requirement(
  requirementId: string,
  description: string,
  technicalControl: string,
  mandatory = true,
): RegulatoryControlRequirement {
  return Object.freeze({ requirementId, description, technicalControl, mandatory });
}

export const DEFAULT_REGULATORY_PROFILES: readonly RegulatoryControlProfile[] = Object.freeze([
  Object.freeze({
    profileId: 'rcp.banking.v1',
    version: '1.0.0',
    category: 'BANKING' as RegulatoryCategory,
    jurisdictions: Object.freeze(['GB', 'US', 'EU']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('banking.kyc', 'Customer identification before account opening', 'KERNEL_IDENTITY_PROOF'),
      requirement('banking.aml', 'AML screening on transactions', 'KERNEL_COMPLIANCE_PROOF'),
      requirement('banking.audit', 'Immutable transaction audit trail', 'LEDGER_APPEND_ONLY'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Engineering shell — requires legal approval before production',
  }),
  Object.freeze({
    profileId: 'rcp.investment.v1',
    version: '1.0.0',
    category: 'INVESTMENT' as RegulatoryCategory,
    jurisdictions: Object.freeze(['GB', 'US']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('investment.suitability', 'Suitability assessment before investment', 'GROWTH_SUITABILITY_CHECK'),
      requirement('investment.disclosure', 'Risk disclosure acknowledgment', 'CONSENT_DISCLOSURE'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Engineering shell — suitability is informational, Kernel decides',
  }),
  Object.freeze({
    profileId: 'rcp.digital_assets.v1',
    version: '1.0.0',
    category: 'DIGITAL_ASSETS' as RegulatoryCategory,
    jurisdictions: Object.freeze(['GB', 'US', 'AE']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('digital_assets.custody', 'Custody controls for native assets', 'CUSTODY_TRAVEL_RULE'),
      requirement('digital_assets.travel_rule', 'Travel Rule for transfers', 'CUSTODY_TRAVEL_RULE'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Simulation only — production custody remains inactive',
  }),
  Object.freeze({
    profileId: 'rcp.exchange.v1',
    version: '1.0.0',
    category: 'EXCHANGE' as RegulatoryCategory,
    jurisdictions: Object.freeze(['GB']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('exchange.surveillance', 'Market surveillance alerts', 'MARKET_SURVEILLANCE'),
      requirement('exchange.settlement', 'Ledger-backed settlement', 'LEDGER_POST_JOURNAL'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Exchange feature gate controls activation per jurisdiction',
  }),
  Object.freeze({
    profileId: 'rcp.money_transmission.v1',
    version: '1.0.0',
    category: 'MONEY_TRANSMISSION' as RegulatoryCategory,
    jurisdictions: Object.freeze(['US', 'SA']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('mt.license', 'Money transmission license evidence', 'OPERATING_SCOPE_LICENSE_EVIDENCE'),
      requirement('mt.corridor', 'Corridor eligibility check', 'OPERATING_SCOPE_CORRIDOR'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Corridor and license evidence required — not a legal permit',
  }),
  Object.freeze({
    profileId: 'rcp.health_data.v1',
    version: '1.0.0',
    category: 'HEALTH_DATA' as RegulatoryCategory,
    jurisdictions: Object.freeze(['US', 'EU']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('health.consent', 'Explicit consent for health data', 'CONSENT_PURPOSE_GATE'),
      requirement('health.minimization', 'Data minimization on access', 'PDV_MINIMIZATION'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Health data contribution feature gate disabled by default',
  }),
  Object.freeze({
    profileId: 'rcp.consumer_privacy.v1',
    version: '1.0.0',
    category: 'CONSUMER_PRIVACY' as RegulatoryCategory,
    jurisdictions: Object.freeze(['EU', 'GB', 'US']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('privacy.purpose', 'Purpose-limited processing', 'CONSENT_PURPOSE_GATE'),
      requirement('privacy.retention', 'Configurable retention enforcement', 'RETENTION_POLICY'),
      requirement('privacy.residency', 'Data residency constraints', 'RESIDENCY_CONSTRAINT'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Privacy controls are technical enablers, not GDPR compliance claims',
  }),
  Object.freeze({
    profileId: 'rcp.research_data.v1',
    version: '1.0.0',
    category: 'RESEARCH_DATA' as RegulatoryCategory,
    jurisdictions: Object.freeze(['GB', 'EU']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('research.consent', 'Research purpose consent', 'CONSENT_PURPOSE_GATE'),
      requirement('research.aggregate', 'Aggregate-only output preferred', 'PDV_AGGREGATE_ONLY'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Research data access requires explicit purpose',
  }),
  Object.freeze({
    profileId: 'rcp.ai_agents.v1',
    version: '1.0.0',
    category: 'AI_AGENTS' as RegulatoryCategory,
    jurisdictions: Object.freeze(['GB', 'US', 'EU']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('agent.mandate', 'Bounded agent mandate', 'AGENT_MANDATE_NARROWING'),
      requirement('agent.proposal_gate', 'ProposalGate before Kernel', 'PROPOSAL_GATE'),
      requirement('agent.no_ea', 'Agent cannot issue Execution Authority', 'AGENT_ISOLATION'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Agent financial automation feature gate controls jurisdiction activation',
  }),
  Object.freeze({
    profileId: 'rcp.cross_border_data.v1',
    version: '1.0.0',
    category: 'CROSS_BORDER_DATA' as RegulatoryCategory,
    jurisdictions: Object.freeze(['EU', 'GB', 'US', 'SA']),
    effectiveFrom: '2026-01-01T00:00:00.000Z' as UtcInstant,
    requirements: Object.freeze([
      requirement('xborder.residency', 'Cross-border storage restriction', 'RESIDENCY_CONSTRAINT'),
      requirement('xborder.transfer', 'Transfer jurisdiction check', 'JURISDICTION_CONTEXT'),
    ]),
    enabled: true,
    legalStatus: LEGAL_REVIEW_STATUS,
    notes: 'Cross-border restrictions are configurable, not legal adequacy decisions',
  }),
]);

export class RegulatoryControlProfileRegistry {
  private readonly profiles: Map<string, RegulatoryControlProfile>;

  constructor(seed: readonly RegulatoryControlProfile[] = DEFAULT_REGULATORY_PROFILES) {
    this.profiles = new Map(seed.map((profile) => [profile.profileId, profile]));
  }

  get(profileId: string): RegulatoryControlProfile | undefined {
    return this.profiles.get(profileId);
  }

  list(): readonly RegulatoryControlProfile[] {
    return Object.freeze([...this.profiles.values()]);
  }

  forCategory(category: RegulatoryCategory): readonly RegulatoryControlProfile[] {
    return Object.freeze([...this.profiles.values()].filter((profile) => profile.category === category));
  }

  applicable(
    category: RegulatoryCategory,
    jurisdiction: string,
    at: UtcInstant,
  ): readonly RegulatoryControlProfile[] {
    return Object.freeze(
      [...this.profiles.values()].filter(
        (profile) =>
          profile.enabled &&
          profile.category === category &&
          profile.effectiveFrom <= at &&
          profile.jurisdictions.includes(jurisdiction),
      ),
    );
  }
}
