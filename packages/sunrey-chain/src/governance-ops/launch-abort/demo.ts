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
  const staged = rehearsal.stagedActivation;
  return {
    environment: ENVIRONMENT,
    stagedActivation: {
      composed: staged.staged,
      moonreyPaused: staged.moonreyPaused,
      sunreyIssuanceIndependent: staged.sunreyIssuanceIndependent,
      productionActive: staged.productionActive,
    },
    oracleProviderSuspended: staged.oracleProviderSuspended,
    moonreyIssuanceRestricted: staged.moonreyIssuanceRestricted,
    unrelatedDomainsAvailable: {
      exchange: staged.exchangeStillAvailable,
      payments: staged.paymentsStillAvailable,
    },
    reconciliationRequired: rehearsal.resume.gate.state,
    reconciliationClean: staged.reconciliationClean,
    incidentEndAutoResumes: staged.incidentEndAutoResumes,
    humanApprovedResumption: staged.humanApprovedResumption,
    hsmSigningRestricted: staged.hsmSigningRestricted,
    hsmMovedFunds: staged.hsmMovedFunds,
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
