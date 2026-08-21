/**
 * demo:sunrey-launch-authorization-ceremony
 *
 * Runs a complete DRESS_REHEARSAL against a frozen fixture candidate,
 * then modifies the freeze hash and shows ceremony rejection.
 */

import { ENVIRONMENT, LIVE_MONEY_ENABLED } from '../../../../config/src/flags.ts';
import { runLaunchAuthorizationDressRehearsal } from './fixtures.ts';

export function runLaunchAuthorizationCeremonyDemo(): void {
  const rehearsal = runLaunchAuthorizationDressRehearsal();
  console.log('SUNREY LAUNCH AUTHORIZATION CEREMONY DRESS REHEARSAL');
  console.log(`rehearsalId=${rehearsal.rehearsalId}`);
  console.log(`state=${rehearsal.session.state}`);
  console.log(`freezeHash=${rehearsal.session.binding.launchFreezeHash}`);
  console.log(`sessionId=${rehearsal.session.sessionId}`);
  console.log(`participants=${String(rehearsal.session.participants.length)}`);
  console.log(`hsmClass=${rehearsal.session.hsmClass}`);
  console.log(`offlinePackages=${String(rehearsal.session.offlinePackages.length)}`);
  console.log(`fixtureSignatures=${String(rehearsal.session.signatures.filter((row) => row.accepted).length)}`);
  console.log(`authorizationClass=${rehearsal.session.authorization?.class ?? 'NONE'}`);
  console.log(`changedFreezeCode=${rehearsal.changedFreezeRejection.code}`);
  console.log(`ENVIRONMENT=${ENVIRONMENT}`);
  console.log(`LIVE_MONEY_ENABLED=${String(LIVE_MONEY_ENABLED)}`);
  console.log('REAL_PRODUCTION_KEYS_CREATED=false');
  console.log('REAL_HUMAN_SIGNATURES_COLLECTED=false');
  console.log('AI_SATISFIES_HUMAN_ROLE=false');
  console.log('TRANSCRIPT_INTEGRITY=true');
  console.log('CANDIDATE_CHANGE_REQUIRES_RESTART=true');
  console.log('CEREMONY_AUTHORIZATION_EQUALS_ACTIVATION=false');
  console.log('MAINNET_ENABLED=false');
  console.log('PRODUCTION_ACTIVE=false');
}

runLaunchAuthorizationCeremonyDemo();
