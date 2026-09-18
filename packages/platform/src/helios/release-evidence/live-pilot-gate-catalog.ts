/**
 * HELIOS H36 — external live-pilot gate checklist catalog.
 */

import type { LivePilotGateClass } from './taxonomy.ts';

export type LivePilotGateCatalogEntry = {
  readonly gateClass: LivePilotGateClass;
  readonly itemKey: string;
  readonly description: string;
  readonly requiresExternalEvidence: boolean;
};

export const LIVE_PILOT_GATE_CATALOG: readonly LivePilotGateCatalogEntry[] = Object.freeze([
  // LEGAL / REGULATORY
  {
    gateClass: 'LEGAL_REGULATORY',
    itemKey: 'operating_legal_entity_identified',
    description: 'Operating legal entity identified',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'LEGAL_REGULATORY',
    itemKey: 'licensing_registration_basis_confirmed',
    description: 'Relevant licensing/registration basis confirmed',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'LEGAL_REGULATORY',
    itemKey: 'partner_license_basis_confirmed',
    description: 'Partner-license basis confirmed if applicable',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'LEGAL_REGULATORY',
    itemKey: 'product_legal_perimeter_reviewed',
    description: 'Product/legal perimeter reviewed',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'LEGAL_REGULATORY',
    itemKey: 'customer_eligibility_confirmed',
    description: 'Customer eligibility confirmed',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'LEGAL_REGULATORY',
    itemKey: 'approved_jurisdiction_capability',
    description: 'Approved jurisdiction capability',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'LEGAL_REGULATORY',
    itemKey: 'disclosure_terms_approved',
    description: 'Disclosure/terms approved',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'LEGAL_REGULATORY',
    itemKey: 'reporting_responsibilities_assigned',
    description: 'Reporting responsibilities assigned',
    requiresExternalEvidence: true,
  },
  // PROVIDER / COMMERCIAL
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'executed_provider_contract',
    description: 'Executed provider contract',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'production_account',
    description: 'Production account',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'production_credentials',
    description: 'Production credentials',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'account_custody_model_confirmed',
    description: 'Account/custody model confirmed',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'funding_route',
    description: 'Funding route',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'execution_route',
    description: 'Execution route',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'withdrawal_route',
    description: 'Withdrawal route',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'provider_production_certification',
    description: 'Provider production certification',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'PROVIDER_COMMERCIAL',
    itemKey: 'service_sla_contact_path',
    description: 'Service/SLA/contact path',
    requiresExternalEvidence: true,
  },
  // SECURITY
  {
    gateClass: 'SECURITY',
    itemKey: 'security_approval',
    description: 'Security approval',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'SECURITY',
    itemKey: 'open_critical_findings_resolved',
    description: 'Open critical findings resolved',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'SECURITY',
    itemKey: 'key_management',
    description: 'Key management',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'SECURITY',
    itemKey: 'custody_signing_controls',
    description: 'Custody/signing controls',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'SECURITY',
    itemKey: 'production_secret_management',
    description: 'Production secret management',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'SECURITY',
    itemKey: 'access_controls',
    description: 'Access controls',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'SECURITY',
    itemKey: 'incident_plan',
    description: 'Incident plan',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'SECURITY',
    itemKey: 'monitoring_alerting',
    description: 'Monitoring/alerting',
    requiresExternalEvidence: true,
  },
  // MODEL / STRATEGY
  {
    gateClass: 'MODEL_STRATEGY',
    itemKey: 'exact_strategy_capsule_qualified',
    description: 'Exact Strategy Capsule qualified',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'MODEL_STRATEGY',
    itemKey: 'model_versions_qualified',
    description: 'Model versions qualified',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'MODEL_STRATEGY',
    itemKey: 'no_expired_strategy',
    description: 'No expired strategy',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'MODEL_STRATEGY',
    itemKey: 'decision_validity_path_qualified',
    description: 'Decision-Validity path qualified',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'MODEL_STRATEGY',
    itemKey: 'paper_shadow_history_available',
    description: 'Paper/shadow history available',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'MODEL_STRATEGY',
    itemKey: 'defined_stop_conditions',
    description: 'Defined stop conditions',
    requiresExternalEvidence: false,
  },
  // RISK
  {
    gateClass: 'RISK',
    itemKey: 'pilot_capital_ceiling',
    description: 'Pilot capital ceiling',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'RISK',
    itemKey: 'per_customer_ceiling',
    description: 'Per-customer ceiling',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'RISK',
    itemKey: 'instrument_limits',
    description: 'Instrument limits',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'RISK',
    itemKey: 'concentration_limits',
    description: 'Concentration limits',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'RISK',
    itemKey: 'loss_drawdown_limits',
    description: 'Loss/drawdown limits',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'RISK',
    itemKey: 'kill_switches',
    description: 'Kill switches',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'RISK',
    itemKey: 'liquidity_rules',
    description: 'Liquidity rules',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'RISK',
    itemKey: 'human_escalation',
    description: 'Human escalation',
    requiresExternalEvidence: false,
  },
  {
    gateClass: 'RISK',
    itemKey: 'emergency_close_policy',
    description: 'Emergency close policy',
    requiresExternalEvidence: false,
  },
  // COMPLIANCE
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'kyc_aml',
    description: 'KYC/AML',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'sanctions',
    description: 'Sanctions',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'suitability_appropriateness',
    description: 'Suitability/appropriateness where applicable',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'customer_mandate',
    description: 'Customer mandate',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'compliance_approvals',
    description: 'Approvals',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'surveillance',
    description: 'Surveillance',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'recordkeeping',
    description: 'Recordkeeping',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'reporting',
    description: 'Reporting',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'COMPLIANCE',
    itemKey: 'case_management',
    description: 'Case management',
    requiresExternalEvidence: true,
  },
  // OPERATIONS
  {
    gateClass: 'OPERATIONS',
    itemKey: 'reconciliation_process',
    description: 'Reconciliation process',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'OPERATIONS',
    itemKey: 'settlement_process',
    description: 'Settlement process',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'OPERATIONS',
    itemKey: 'daily_review',
    description: 'Daily review',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'OPERATIONS',
    itemKey: 'provider_escalation',
    description: 'Provider escalation',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'OPERATIONS',
    itemKey: 'support',
    description: 'Support',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'OPERATIONS',
    itemKey: 'backup',
    description: 'Backup',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'OPERATIONS',
    itemKey: 'rollback',
    description: 'Rollback',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'OPERATIONS',
    itemKey: 'incident_response',
    description: 'Incident response',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'OPERATIONS',
    itemKey: 'business_continuity',
    description: 'Business continuity',
    requiresExternalEvidence: true,
  },
  // CUSTOMER
  {
    gateClass: 'CUSTOMER',
    itemKey: 'customer_selected',
    description: 'Customer selected',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'CUSTOMER',
    itemKey: 'consent_mandate',
    description: 'Consent/mandate',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'CUSTOMER',
    itemKey: 'disclosures',
    description: 'Disclosures',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'CUSTOMER',
    itemKey: 'risk_acknowledgement',
    description: 'Risk acknowledgement',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'CUSTOMER',
    itemKey: 'provider_agreements',
    description: 'Provider agreements',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'CUSTOMER',
    itemKey: 'funding_authority',
    description: 'Funding authority',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'CUSTOMER',
    itemKey: 'withdrawal_destination',
    description: 'Withdrawal destination',
    requiresExternalEvidence: true,
  },
  {
    gateClass: 'CUSTOMER',
    itemKey: 'pilot_terms',
    description: 'Pilot terms',
    requiresExternalEvidence: true,
  },
]);
