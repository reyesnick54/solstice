/**
 * demo:sunrey-production-launch-freeze
 *
 * Assembles the current engineering launch freeze, prints blockers,
 * then simulates provider-evidence expiry and shows STALE.
 * Freeze is not approval and not activation.
 */

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
} from '../../../../../config/src/flags.ts';
import { evaluateCurrentRepositoryLaunchFreeze } from './assemble.ts';
import { snapshotExternalEvidence } from './bindings.ts';
import { fixtureEvidenceLaunchFreeze, fixtureEvidenceRegistry } from './fixtures.ts';
import { buildLaunchFreezeOfflinePackage } from './offline.ts';
import { formatLaunchFreezeReport } from './report.ts';
import { evaluateLaunchCandidateStaleness, observationFromFreeze } from './staleness.ts';

export function runProductionLaunchFreezeDemo(root = process.cwd()): void {
  const current = evaluateCurrentRepositoryLaunchFreeze(root);
  const offline = buildLaunchFreezeOfflinePackage(current.freeze);
  console.log(formatLaunchFreezeReport(current));
  console.log(`offlineFreezeHash=${offline.freezeHash}`);
  console.log(`offlineContainsSecrets=${String(offline.rawSecretsPresent)}`);
  console.log(`reviewArtifactStatus=${current.freeze.status}`);

  const beforeExpiry = fixtureEvidenceLaunchFreeze(root, '2026-08-21T00:00:00.000Z', '2026-08-21T12:00:00.000Z');
  const expiredSnapshot = snapshotExternalEvidence(fixtureEvidenceRegistry('2026-08-21T12:00:00.000Z'), '2026-08-22T00:00:00.000Z');
  const stale = evaluateLaunchCandidateStaleness(beforeExpiry.freeze, {
    ...observationFromFreeze(beforeExpiry.freeze),
    externalEvidenceSnapshotHash: expiredSnapshot.snapshotHash,
    externalEvidenceExpired: expiredSnapshot.expired,
    environmental: {
      cpuTemperature: 71,
      temporaryLocalTestDurationMs: 12,
      wallClockMonitoringMetric: '2026-08-22T00:00:00.000Z',
    },
  });

  console.log('SIMULATED_PROVIDER_EVIDENCE_EXPIRY');
  console.log(`candidateBecomes=${stale.status}`);
  console.log(`stalenessReasons=${stale.reasons.join(',')}`);
  console.log(`environmentalMetricsIgnored=${String(stale.environmentalMetricsIgnored)}`);
  console.log(`FREEZE_HASH=${current.freeze.freezeHash}`);
  console.log(`FLOATING_VERSIONS_PRESENT=${String(current.bom.implicitVersionsPresent)}`);
  console.log('RAW_SECRETS_PRESENT=false');
  console.log(`PRODUCTION_PARAMETERS_COMPLETE=${String(current.productionParametersComplete)}`);
  console.log(`EXTERNAL_EVIDENCE_COMPLETE=${String(current.externalEvidenceComplete)}`);
  console.log(`HUMAN_AUTHORIZATION_COMPLETE=${String(current.humanAuthorizationComplete)}`);
  console.log('FREEZE_EQUALS_APPROVAL=false');
  console.log('FREEZE_EQUALS_ACTIVATION=false');
  console.log('LIVE_CONNECTIVITY_ENABLED=false');
  console.log('PRODUCTION_ACTIVE=false');
  console.log(`ENVIRONMENT=${ENVIRONMENT}`);
  console.log(`LIVE_MONEY_ENABLED=${String(LIVE_MONEY_ENABLED)}`);
  console.log(`LIVE_PAYMENTS_ENABLED=${String(LIVE_PAYMENTS_ENABLED)}`);
  console.log(`LIVE_BANKING_RAILS=${String(LIVE_BANKING_RAILS)}`);
  console.log(`LIVE_EXTERNAL_KYC=${String(LIVE_EXTERNAL_KYC)}`);
  console.log(`LIVE_EXTERNAL_BANK_CONNECTION=${String(LIVE_EXTERNAL_BANK_CONNECTION)}`);
  console.log(`LIVE_TRADING_ENABLED=${String(LIVE_TRADING_ENABLED)}`);
  console.log(`LIVE_CRYPTO_ENABLED=${String(LIVE_CRYPTO_ENABLED)}`);
  console.log(`LIVE_EXCHANGE_ENABLED=${String(LIVE_EXCHANGE_ENABLED)}`);
  console.log(`LIVE_DATA_MARKET_ENABLED=${String(LIVE_DATA_MARKET_ENABLED)}`);
  console.log(`LIVE_INVESTMENT_EXECUTION=${String(LIVE_INVESTMENT_EXECUTION)}`);
}

runProductionLaunchFreezeDemo();
