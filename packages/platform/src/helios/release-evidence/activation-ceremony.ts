/**
 * HELIOS H36 — live-pilot activation ceremony contract (define only; never execute without authorization).
 */

import { PILOT_ACTIVATION_CEREMONY_STEPS } from './taxonomy.ts';
import type { HeliosReleaseId, LivePilotScopeId } from './ids.ts';
import type { PilotActivationCeremonyContract } from './types.ts';

const STEP_DESCRIPTIONS: Record<(typeof PILOT_ACTIVATION_CEREMONY_STEPS)[number], string> = {
  SELECT_QUALIFIED_RELEASE: 'Select a HELIOS release evidence package with engineering qualification bound to an exact Git SHA.',
  SELECT_EXACT_PILOT_SCOPE: 'Select one narrow pilot scope: jurisdiction, legal entity, provider, customer class, strategy, capital ceiling, and duration.',
  VERIFY_GATE_EVIDENCE_CURRENT: 'Verify all external gate evidence is current and not expired.',
  VERIFY_APPROVERS: 'Verify authorized governance approvers for each required role.',
  SNAPSHOT_BACKUP: 'Snapshot/backup operational state before any scoped activation.',
  VERIFY_PROVIDER_PRODUCTION_CREDENTIALS: 'Verify production credentials through provider confirmation evidence — never store secrets in the evidence package.',
  VERIFY_RISK_LIMITS: 'Verify scoped risk limits, kill switches, and abort conditions.',
  VERIFY_CUSTOMER_MANDATE: 'Verify customer consent/mandate and disclosures.',
  VERIFY_MONITORING_ON_CALL: 'Verify monitoring, alerting, and on-call responsibility.',
  ISSUE_SCOPED_HUMAN_AUTHORIZATION: 'Issue LivePilotAuthorization signed by authorized governance roles — AI cannot sign.',
  ACTIVATE_ONLY_SCOPED_CAPABILITY: 'Activate only the scoped capability; no global LIVE=true.',
  PERFORM_MINIMAL_CANARY_OPERATION: 'Perform a minimal canary operation within scope and reconcile.',
  RECONCILE: 'Reconcile in-flight and completed operations against provider and ledger truth.',
  VERIFY_REPORTING_EVIDENCE: 'Verify reporting and evidence vault sealing for the canary.',
  EXPAND_ONLY_THROUGH_NEW_AUTHORIZATION: 'Any expansion requires a new scoped authorization; prior authorization does not silently broaden scope.',
};

export function buildPilotActivationCeremonyContract(input: {
  readonly ceremonyId: string;
  readonly releaseId: HeliosReleaseId;
  readonly scopeId: LivePilotScopeId;
}): PilotActivationCeremonyContract {
  return Object.freeze({
    ceremonyId: input.ceremonyId,
    releaseId: input.releaseId,
    scopeId: input.scopeId,
    steps: Object.freeze(
      PILOT_ACTIVATION_CEREMONY_STEPS.map((step) =>
        Object.freeze({
          step,
          description: STEP_DESCRIPTIONS[step],
          requiresHumanAction: step !== 'SELECT_QUALIFIED_RELEASE',
          mayActivateLiveConnectivity: false as const,
        }),
      ),
    ),
    abortOnFailure: true as const,
    expandsOnlyThroughNewAuthorization: true as const,
  });
}

export function refuseUnauthorizedActivationCeremony(input: {
  readonly authorizationPresent: boolean;
  readonly allGatesSatisfied: boolean;
}): void {
  if (!input.authorizationPresent || !input.allGatesSatisfied) {
    throw new TypeError(
      'pilot activation ceremony cannot execute without scoped human authorization and satisfied gates',
    );
  }
}
