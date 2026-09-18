import type { GrowDegradedStateContract, DegradedEvaluationInput } from './types.ts';

function state(
  input: DegradedEvaluationInput,
  code: GrowDegradedStateContract['code'],
  severity: GrowDegradedStateContract['severity'],
  affectedCapability: string,
  customerImpact: string,
  fundsAffected: boolean,
  newDeploymentPaused: boolean,
  withdrawalsAvailable: boolean,
  customerActionRequired: boolean,
  message: string,
): GrowDegradedStateContract {
  return Object.freeze({
    code,
    severity,
    affectedCapability,
    customerImpact,
    fundsAffected,
    newDeploymentPaused: newDeploymentPaused || input.deploymentPaused,
    withdrawalsAvailable,
    customerActionRequired,
    message,
    evidenceRef: null,
    observedAt: input.now,
  });
}

export function evaluateOperationalDegradedStates(input: DegradedEvaluationInput): readonly GrowDegradedStateContract[] {
  const rows: GrowDegradedStateContract[] = [];
  if (input.marketDataStale) {
    rows.push(
      state(
        input,
        'MARKET_DATA_DEGRADED',
        'WARNING',
        'NEW_DEPLOYMENT',
        'Time-sensitive deployment is paused until market data refreshes.',
        false,
        true,
        true,
        false,
        'Market data is stale. New time-sensitive deployment is paused.',
      ),
    );
  }
  if (input.researchProviderDown) {
    rows.push(
      state(
        input,
        'RESEARCH_PROVIDER_DEGRADED',
        'WARNING',
        'PUBLIC_RESEARCH',
        'Public AI research is temporarily unavailable. Existing positions continue.',
        false,
        false,
        true,
        false,
        'Research provider is degraded. Existing positions are unaffected.',
      ),
    );
  }
  if (input.s3mUnavailable) {
    rows.push(
      state(
        input,
        'S3M_UNAVAILABLE',
        'WARNING',
        'PRIVATE_RESEARCH',
        'Private-context research is unavailable. Private data is not sent to fallback providers.',
        false,
        false,
        true,
        false,
        'Private research is unavailable. Your private context stays protected.',
      ),
    );
  }
  if (input.executionProviderDown) {
    rows.push(
      state(
        input,
        'PROVIDER_EXECUTION_DEGRADED',
        'CRITICAL',
        'EXECUTION',
        'Execution provider is down. Unknown orders are not blindly resubmitted.',
        false,
        true,
        true,
        false,
        'Execution provider is degraded. New deployment is paused.',
      ),
    );
  }
  if (input.providerActionRequired) {
    rows.push(
      state(
        input,
        'PROVIDER_ACCOUNT_ACTION_REQUIRED',
        'CRITICAL',
        'PROVIDER_ACCOUNT',
        'Provider requires customer action before some operations continue.',
        true,
        true,
        false,
        true,
        'Your provider account needs action before some Grow operations can continue.',
      ),
    );
  }
  if (input.reconciliationPending) {
    rows.push(
      state(
        input,
        'RECONCILIATION_PENDING',
        'INFO',
        'RECONCILIATION',
        'Reconciliation is in progress. Cash availability may be conservative.',
        false,
        false,
        true,
        false,
        'Reconciliation is pending. Available cash reflects conservative checks.',
      ),
    );
  }
  if (input.reconciliationMismatch) {
    rows.push(
      state(
        input,
        'RECONCILIATION_MISMATCH',
        'CRITICAL',
        'CAPITAL_REUSE',
        'Reconciliation mismatch blocks unsafe capital reuse.',
        true,
        true,
        false,
        false,
        'Reconciliation mismatch detected. Unsafe capital reuse is blocked.',
      ),
    );
  }
  if (input.settlementDelayed) {
    rows.push(
      state(
        input,
        'SETTLEMENT_DELAYED',
        'WARNING',
        'SETTLEMENT',
        'Settlement is delayed. Proceeds are not yet available cash.',
        true,
        false,
        true,
        false,
        'Settlement is delayed. Proceeds are not yet available for withdrawal.',
      ),
    );
  }
  if (input.valuationStale) {
    rows.push(
      state(
        input,
        'VALUATION_STALE',
        'WARNING',
        'VALUATION',
        'Last valid mark is shown with a stale warning. Current value is not fabricated.',
        false,
        false,
        true,
        false,
        'Position valuation may be stale. Last valid mark is shown.',
      ),
    );
  }
  if (input.capabilityReviewRequired) {
    rows.push(
      state(
        input,
        'CAPABILITY_REVIEW_REQUIRED',
        'WARNING',
        'CAPABILITY',
        'Capability review is required before new deployment resumes.',
        false,
        true,
        true,
        false,
        'Capability review is required before new deployment can resume.',
      ),
    );
  }
  if (input.regulatoryRestriction) {
    rows.push(
      state(
        input,
        'REGULATORY_RESTRICTION',
        'CRITICAL',
        'COMPLIANCE',
        'Regulatory restriction limits some Grow operations in your jurisdiction.',
        true,
        true,
        false,
        false,
        'A regulatory restriction applies to some Grow operations.',
      ),
    );
  }
  if (input.strategyReviewRequired) {
    rows.push(
      state(
        input,
        'STRATEGY_REVIEW_REQUIRED',
        'WARNING',
        'STRATEGY',
        'Strategy review is required. Future activity may move to review or pause.',
        false,
        true,
        true,
        false,
        'Strategy review is required before new deployment continues.',
      ),
    );
  }
  if (input.systemMaintenance) {
    rows.push(
      state(
        input,
        'SYSTEM_MAINTENANCE',
        'INFO',
        'PLATFORM',
        'System maintenance may limit some non-critical operations.',
        false,
        false,
        true,
        false,
        'System maintenance is in progress. Core holdings and settlement continue.',
      ),
    );
  }
  return Object.freeze(rows);
}
