import {
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_BLOCKED,
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED,
  OPTIONS_EXECUTION_MODE,
} from './taxonomy.ts';

export { HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED, HELIOS_EARN07_OPTIONS_INTELLIGENCE_BLOCKED };

export type Earn07QualificationChecks = {
  readonly providerNeutralInputsPresent: boolean;
  readonly pitTimestampAndAafCertified: boolean;
  readonly preEventMetricsComputed: boolean;
  readonly expectationStateBuilt: boolean;
  readonly realizedComparisonIsolated: boolean;
  readonly researchAgentNoExecution: boolean;
  readonly optionsExecutionDisabled: boolean;
  readonly dealerGammaProxyLabeled: boolean;
};

export type Earn07QualificationResult = {
  readonly marker:
    | typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED
    | typeof HELIOS_EARN07_OPTIONS_INTELLIGENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateEarn07OptionsIntelligenceQualification(
  checks: Earn07QualificationChecks,
): Earn07QualificationResult {
  const blockers: string[] = [];
  const entries: [keyof Earn07QualificationChecks, string][] = [
    ['providerNeutralInputsPresent', 'provider_neutral_inputs'],
    ['pitTimestampAndAafCertified', 'pit_aaf_certified'],
    ['preEventMetricsComputed', 'pre_event_metrics'],
    ['expectationStateBuilt', 'expectation_state'],
    ['realizedComparisonIsolated', 'realized_isolated'],
    ['researchAgentNoExecution', 'research_agent_no_execution'],
    ['optionsExecutionDisabled', 'options_execution_disabled'],
    ['dealerGammaProxyLabeled', 'dealer_gamma_proxy_labeled'],
  ];
  for (const [key, label] of entries) {
    if (!checks[key]) {
      blockers.push(label);
    }
  }
  if (OPTIONS_EXECUTION_MODE !== 'DISABLED_RESEARCH_ONLY') {
    blockers.push('execution_mode');
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED
      : HELIOS_EARN07_OPTIONS_INTELLIGENCE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
