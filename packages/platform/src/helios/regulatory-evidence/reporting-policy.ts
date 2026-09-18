/**
 * H28-approved capability/reporting policy fixture consumed by H29 trigger engine.
 * Unknown statutory values remain LEGAL_REVIEW_REQUIRED / UNMAPPED — not invented here.
 */
import type { Jurisdiction } from '../../../../domain/src/jurisdiction.ts';
import {
  HELIOS_H28_REPORTING_POLICY_VERSION,
  type DueRuleKind,
  type ReportingTriggerCategory,
  type ResponsibleFilerState,
} from './taxonomy.ts';

export type ApprovedPolicyObligationRef = {
  readonly policyObligationRef: string;
  readonly jurisdiction: Jurisdiction | 'UNMAPPED';
  readonly legalEntityRef: string;
  readonly productActivity: string;
  readonly triggerCategory: ReportingTriggerCategory;
  readonly reportType: string;
  readonly responsibleFiler: ResponsibleFilerState;
  readonly dueRuleKind: DueRuleKind;
  /** Approved offset days when dueRuleKind is APPROVED_POLICY_OFFSET; null otherwise. */
  readonly dueOffsetDays: number | null;
  readonly evidenceRequirementRefs: readonly string[];
  readonly submissionChannelRef: string | null;
  readonly retentionClassRef: string;
  readonly approvedPolicySourceRef: string;
  readonly mappingStatus: 'APPROVED' | 'LEGAL_REVIEW_REQUIRED' | 'UNMAPPED';
};

export type ApprovedReportingPolicyCatalog = {
  readonly policyVersion: typeof HELIOS_H28_REPORTING_POLICY_VERSION;
  readonly obligations: readonly ApprovedPolicyObligationRef[];
};

/** Fixture catalog — only pre-approved mappings; no invented statutory deadlines. */
export const APPROVED_HELIOS_REPORTING_POLICY: ApprovedReportingPolicyCatalog = Object.freeze({
  policyVersion: HELIOS_H28_REPORTING_POLICY_VERSION,
  obligations: Object.freeze([
    Object.freeze({
      policyObligationRef: 'helios.us.paper_trade_activity.v1',
      jurisdiction: 'US' as Jurisdiction,
      legalEntityRef: 'le_sunrey_us_sim',
      productActivity: 'HELIOS_PAPER_INVESTMENT',
      triggerCategory: 'ORDER_TRADING_EVENT' as ReportingTriggerCategory,
      reportType: 'INTERNAL_TRADE_ACTIVITY_LOG',
      responsibleFiler: 'SUNREY_RESPONSIBLE' as ResponsibleFilerState,
      dueRuleKind: 'APPROVED_POLICY_OFFSET' as DueRuleKind,
      dueOffsetDays: 5,
      evidenceRequirementRefs: Object.freeze(['ev_req_trade_record', 'ev_req_compliance_decision']),
      submissionChannelRef: 'channel_internal_compliance_portal',
      retentionClassRef: 'ret_regulatory_standard_us_sim',
      approvedPolicySourceRef: 'policy/helios/us/paper-trade-activity-v1-approved-fixture.json',
      mappingStatus: 'APPROVED' as const,
    }),
    Object.freeze({
      policyObligationRef: 'helios.us.large_notional_threshold.v1',
      jurisdiction: 'US' as Jurisdiction,
      legalEntityRef: 'le_sunrey_us_sim',
      productActivity: 'HELIOS_PAPER_INVESTMENT',
      triggerCategory: 'THRESHOLD_REPORTABLE_ACTIVITY' as ReportingTriggerCategory,
      reportType: 'LARGE_ACTIVITY_REVIEW',
      responsibleFiler: 'JOINT_WORKFLOW' as ResponsibleFilerState,
      dueRuleKind: 'APPROVED_POLICY_OFFSET' as DueRuleKind,
      dueOffsetDays: 10,
      evidenceRequirementRefs: Object.freeze(['ev_req_trade_record', 'ev_req_customer_context', 'ev_req_risk_decision']),
      submissionChannelRef: 'channel_partner_compliance_workflow',
      retentionClassRef: 'ret_regulatory_standard_us_sim',
      approvedPolicySourceRef: 'policy/helios/us/large-notional-threshold-v1-approved-fixture.json',
      mappingStatus: 'APPROVED' as const,
    }),
    Object.freeze({
      policyObligationRef: 'helios.us.compliance_alert.v1',
      jurisdiction: 'US' as Jurisdiction,
      legalEntityRef: 'le_sunrey_us_sim',
      productActivity: 'HELIOS_COMPLIANCE',
      triggerCategory: 'SUSPICIOUS_COMPLIANCE_EVENT' as ReportingTriggerCategory,
      reportType: 'COMPLIANCE_CASE_ACTIVITY',
      responsibleFiler: 'SUNREY_RESPONSIBLE' as ResponsibleFilerState,
      dueRuleKind: 'LEGAL_REVIEW_REQUIRED' as DueRuleKind,
      dueOffsetDays: null,
      evidenceRequirementRefs: Object.freeze(['ev_req_compliance_decision', 'ev_req_case_record']),
      submissionChannelRef: null,
      retentionClassRef: 'ret_legal_hold_pending_review',
      approvedPolicySourceRef: 'policy/helios/us/compliance-alert-v1-legal-review-required.json',
      mappingStatus: 'LEGAL_REVIEW_REQUIRED' as const,
    }),
    Object.freeze({
      policyObligationRef: 'helios.eu.provider_account_event.v1',
      jurisdiction: 'UNMAPPED' as const,
      legalEntityRef: 'le_sunrey_eu_sim',
      productActivity: 'HELIOS_PROVIDER',
      triggerCategory: 'PROVIDER_ACCOUNT_EVENT' as ReportingTriggerCategory,
      reportType: 'PROVIDER_ACCOUNT_ACTIVITY',
      responsibleFiler: 'PROVIDER_RESPONSIBLE' as ResponsibleFilerState,
      dueRuleKind: 'UNMAPPED' as DueRuleKind,
      dueOffsetDays: null,
      evidenceRequirementRefs: Object.freeze(['ev_req_provider_evidence']),
      submissionChannelRef: null,
      retentionClassRef: 'ret_unmapped',
      approvedPolicySourceRef: 'policy/helios/eu/provider-account-unmapped.json',
      mappingStatus: 'UNMAPPED' as const,
    }),
    Object.freeze({
      policyObligationRef: 'helios.us.research_only.v1',
      jurisdiction: 'US' as Jurisdiction,
      legalEntityRef: 'le_sunrey_us_sim',
      productActivity: 'HELIOS_RESEARCH',
      triggerCategory: 'ALGORITHM_MODEL_EVENT' as ReportingTriggerCategory,
      reportType: 'MODEL_ACTIVITY_LOG',
      responsibleFiler: 'SUNREY_RESPONSIBLE' as ResponsibleFilerState,
      dueRuleKind: 'APPROVED_POLICY_OFFSET' as DueRuleKind,
      dueOffsetDays: 30,
      evidenceRequirementRefs: Object.freeze(['ev_req_model_version']),
      submissionChannelRef: 'channel_internal_audit',
      retentionClassRef: 'ret_regulatory_standard_us_sim',
      approvedPolicySourceRef: 'policy/helios/us/model-activity-v1-approved-fixture.json',
      mappingStatus: 'APPROVED' as const,
    }),
  ]),
});

export function findPolicyObligationsForTrigger(
  triggerCategory: ReportingTriggerCategory,
  jurisdiction: Jurisdiction | null,
  productActivity: string,
): readonly ApprovedPolicyObligationRef[] {
  return APPROVED_HELIOS_REPORTING_POLICY.obligations.filter((obl) => {
    if (obl.triggerCategory !== triggerCategory) {
      return false;
    }
    if (obl.productActivity !== productActivity && obl.productActivity !== 'HELIOS_COMPLIANCE') {
      return false;
    }
    if (obl.jurisdiction === 'UNMAPPED') {
      return jurisdiction === null;
    }
    return jurisdiction === null || obl.jurisdiction === jurisdiction;
  });
}

export function approvedRetentionYears(retentionClassRef: string): number | null {
  if (retentionClassRef === 'ret_regulatory_standard_us_sim') {
    return 7;
  }
  return null;
}
