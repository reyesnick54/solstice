/**
 * demo:sunrey-launch-abort-recovery
 *
 * Rehearses staged activation, an oracle integrity incident, provider
 * suspension, MoonRey issuance restriction, unrelated-domain availability,
 * reconciliation, human-approved resumption, then HSM signing restriction.
 */

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../../../config/src/flags.ts';
import { runLaunchAbortRecoveryRehearsal } from './rehearsals.ts';

export function runLaunchAbortRecoveryDemo(): Record<string, unknown> {
  const rehearsal = runLaunchAbortRecoveryRehearsal();
  return {
    environment: ENVIRONMENT,
    stagedActivation: rehearsal.stagedActivation,
    oracleProviderSuspended: rehearsal.oracle.suspend.accepted,
    moonreyIssuanceRestricted: rehearsal.oracle.issuance.accepted,
    unrelatedDomainsAvailable: {
      exchange: rehearsal.oracle.exchangeStillAvailable,
      payments: rehearsal.oracle.paymentsStillAvailable,
    },
    reconciliationRequired: rehearsal.resume.gate.state,
    incidentEndAutoResumes: rehearsal.resume.incidentEndEnabledRuntime,
    humanApprovedResumption: rehearsal.resume.humanResumed,
    hsmSigningRestricted: rehearsal.hsm.signingBlocked,
    hsmMovedFunds: rehearsal.hsm.fundsMoved,
    liveFlags: {
      LIVE_MONEY_ENABLED,
      LIVE_PAYMENTS_ENABLED,
      LIVE_BANKING_RAILS,
      LIVE_EXTERNAL_KYC,
      LIVE_EXTERNAL_BANK_CONNECTION,
    },
    ...rehearsal.flags,
  };
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('demo.ts') || entry.endsWith('demo.js')) {
  console.log('SunRey launch abort and recovery rehearsal');
  const result = runLaunchAbortRecoveryDemo();
  console.log(JSON.stringify(result, null, 2));
  console.log('GLOBAL_SUPER_ADMIN_EXISTS=false');
  console.log('EMERGENCY_CAN_MINT=false');
  console.log('EMERGENCY_CAN_REWRITE_SUPPLY=false');
  console.log('EMERGENCY_CAN_REWRITE_FINALIZED_HISTORY=false');
  console.log('RESTRICTIONS_DOMAIN_SCOPED=true');
  console.log('INCIDENT_END_AUTO_RESUMES=false');
  console.log('AI_CAN_AUTHORIZE_EMERGENCY=false');
  console.log('PRODUCTION_ACTIVE=false');
}
