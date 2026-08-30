/**
 * ACCESS-19 — Full productive-engine integration demo.
 */

import { runProductiveAccessIntegration } from './integration.ts';

export function runProductiveAccessBridgeIntegrationDemo(): string {
  const result = runProductiveAccessIntegration();
  const demo = result.fleetDemo;
  const lines = [
    'ACCESS-19 MoonRey Productive Capacity to Access Bridge (Integrated)',
    '===================================================================',
    '',
    'Productive Engine (Chunk 44)',
    `  verified fleet capacity:      ${demo.totalVerifiedVehicleHours} vehicle-hours`,
    `  MoonRey supply before Access: ${result.moonreySupplyBeforeAccess}`,
    `  MoonRey supply after Access:  ${result.moonreySupplyAfterAccess}`,
    `  MR issued by Access usage:    ${demo.moonreyIssuedByAccess}`,
    '',
    'Access Capacity Pool',
    `  committed to Access:          ${demo.committedVehicleHours} vehicle-hours`,
    `  participant consumed:         ${demo.consumedVehicleDays} vehicle-days`,
    `  remaining pool:               ${demo.remainingPoolVehicleHours} vehicle-hours`,
  '',
    'Capacity Expansion Loop',
    `  productive capacity can rise: ${result.capacityExpansionDemonstrated}`,
    `  allocatable Access can rise:  ${result.capacityExpansionDemonstrated}`,
    `  automatic SR/MR mint:       false`,
    '',
    'Provider Settlement',
    `  fiat minor units:             ${demo.providerSettlement.terms.fiatMinorUnits}`,
    `  MR settlement (contract):   ${demo.providerSettlement.terms.moonreyMinorUnits}`,
    `  settlement != issuance:       ${demo.providerSettlement.moonreyIssuanceRef === null}`,
    '',
    'Reconciliation',
    `  reconciled:                   ${demo.reconciliation.reconciled}`,
    '',
    'Invariants',
  ];
  for (const invariant of demo.invariants) {
    lines.push(`  [${invariant.held ? 'PASS' : 'FAIL'}] ${invariant.invariant}`);
  }
  lines.push('');
  lines.push(
    `qualification: ${demo.invariantsHeld ? 'ACCESS_19_INTEGRATED_QUALIFIED' : 'ACCESS_19_INTEGRATED_NOT_QUALIFIED'}`,
  );
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = runProductiveAccessBridgeIntegrationDemo();
  console.log(output);
  if (output.includes('NOT_QUALIFIED')) {
    process.exitCode = 1;
  }
}
