/**
 * ACCESS-19 — MoonRey Productive Capacity to Access Bridge demo.
 *
 * Runs the autonomous fleet scenario with fixture capacity. For the full
 * productive-engine integration demo see sunrey-economics productive-access-bridge.
 */

import { ProductiveAccessBridge, runAutonomousFleetBridgeDemo } from './bridge.ts';
import { FIXTURE_AUTONOMOUS_VEHICLE_FLEET } from './fixtures.ts';

export function runProductiveAccessBridgeDemo(): string {
  const bridge = new ProductiveAccessBridge();
  const result = runAutonomousFleetBridgeDemo({
    bridge,
    verifiedCapacity: FIXTURE_AUTONOMOUS_VEHICLE_FLEET,
    moonreyBefore: 0n,
    moonreyAfter: 1_250n,
    moonreyIssuance: Object.freeze({
      issuanceId: 'issuance.fleet.productive.output',
      contributionFingerprint: FIXTURE_AUTONOMOUS_VEHICLE_FLEET.contributionFingerprint!,
      moonreyQuantity: 1_250n,
      issuedAt: FIXTURE_AUTONOMOUS_VEHICLE_FLEET.observedAt,
      triggeredByAccess: false,
    }),
  });

  const lines = [
    'ACCESS-19 MoonRey Productive Capacity to Access Bridge',
    '======================================================',
    '',
    'Autonomous Fleet Scenario',
    `  total verified vehicle-hours: ${result.totalVerifiedVehicleHours}`,
    `  committed to Access pool:     ${result.committedVehicleHours}`,
    `  participant consumed:       ${result.consumedVehicleDays} vehicle-days (${result.consumedVehicleHours} vehicle-hours)`,
    `  remaining verified capacity:  ${result.remainingVerifiedVehicleHours}`,
    `  remaining pool capacity:      ${result.remainingPoolVehicleHours}`,
    '',
    'MoonRey Economics',
    `  MR before Access usage:       ${result.moonreyIssuanceBefore}`,
    `  MR after productive issuance: ${result.moonreyIssuanceAfter}`,
    `  MR issued by Access usage:    ${result.moonreyIssuedByAccess}`,
    '',
    'Provider Settlement',
    `  settlement id:                ${result.providerSettlement.settlementId}`,
    `  fiat minor units:             ${result.providerSettlement.terms.fiatMinorUnits}`,
    `  MR minor units (contract):    ${result.providerSettlement.terms.moonreyMinorUnits}`,
    `  MR issuance ref:              ${result.providerSettlement.moonreyIssuanceRef}`,
    '',
    'Reconciliation',
    `  reconciled:                   ${result.reconciliation.reconciled}`,
    '',
    'Invariants',
  ];

  for (const invariant of result.invariants) {
    lines.push(`  [${invariant.held ? 'PASS' : 'FAIL'}] ${invariant.invariant}`);
  }
  lines.push('');
  lines.push(`qualification: ${result.invariantsHeld ? 'ACCESS_19_BRIDGE_QUALIFIED' : 'ACCESS_19_BRIDGE_NOT_QUALIFIED'}`);

  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = runProductiveAccessBridgeDemo();
  console.log(output);
  if (output.includes('NOT_QUALIFIED')) {
    process.exitCode = 1;
  }
}
