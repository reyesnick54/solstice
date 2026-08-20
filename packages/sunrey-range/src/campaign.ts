import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { SCENARIO_CATALOG, runScenarioIsolated } from './catalog.ts';
import { createRangeEnvironment } from './environment.ts';
import { evidenceRecord, redact, writeEvidenceArtifact } from './evidence.ts';
import { countSeverities, invariantBreachCount } from './production-safety.ts';
import { buildScorecard } from './scorecard.ts';
import type { AttackResult, CampaignReport } from './types.ts';

export const SMOKE_SCENARIO_IDS = [
  'BFT-DOUBLE-PROPOSAL',
  'BFT-POWER-GT-1-3',
  'NET-PARTITION',
  'NET-ECLIPSE-SENTRY',
  'SIGNER-ROLLBACK',
  'WALLET-OVER-LIMIT',
  'MULTISIG-DUPLICATE',
  'ORACLE-STALE-REPLAY',
  'MOONREY-DUPLICATE-CLAIM',
  'MACHINE-OVERSPEND',
  'EXCH-SELF-TRADE',
  'EXCH-FABRICATED-INTENT',
  'INFO-RAW-ROW-EXPORT',
  'CUSTODY-SINGLE-APPROVER',
  'GOV-AI-APPROVAL',
  'INTEROP-PACKET-REPLAY',
  'BRIDGE-DUP-RECEIVE',
  'API-BURST',
  'EXPLORER-PDV',
  'COMPOUND-ORACLE-VALIDATOR-EXCHANGE',
  'ECON-ORACLE-STALE',
] as const;

export const PRODUCTION_SAFETY_SMOKE_IDS = [
  'CRED-WRONG-WORKLOAD',
  'CRED-AUTHORIZATION-HEADER-LOG',
  'ENDPOINT-METADATA',
  'ENDPOINT-CREDENTIAL-IN-URL',
  'ORADV-FALSE-INDEPENDENCE',
  'ORADV-REFERENCE-PRICE',
  'PRODATT-MANUFACTURING-GOODS',
  'HUMAN-WORTH-FIELD',
  'HUMAN-AI-APPROVE',
  'PAY-IDEMPOTENCY-AMOUNT',
  'PAY-TIMEOUT-AFTER-SUCCESS',
  'PAY-PROVIDER-CLAIMS-DISABLED-CORRIDOR',
  'COMPLY-SANCTIONS-TIMEOUT-CLEAR',
  'COMPLY-AI-COUNSEL-REVIEW',
  'TRAVEL-ACK-AS-WITHDRAWAL',
  'CUSTADV-MOONREY-AS-SUNREY',
  'CUSTADV-PRIVATE-KEY-EXPORT',
  'CUSTADV-DUPLICATE-WITHDRAWAL',
  'PERSIST-CHECKSUM',
  'EVENT-DUPLICATE',
  'IDEM-QUERY-NOT-RESUBMIT',
  'CONST-AI-TOKENOMICS',
  'AIAUTH-ISSUE-AUTHORITY',
  'OBS-SECRET-TRACE',
  'CTRL-FLIP-LIVE',
  'COMPSAFE-KYC-SANCTIONS-AI',
] as const;

export const PRODUCTION_SAFETY_EXTENDED_IDS = SCENARIO_CATALOG
  .filter((row) => row.fixtureVersion === 'sunrey.range.fixture.v157')
  .map((row) => row.scenarioId);

export function runCampaign(ids: readonly string[] = SCENARIO_CATALOG.map((row) => row.scenarioId)): CampaignReport {
  const env = createRangeEnvironment(57);
  const results: AttackResult[] = ids.map((id) => runScenarioIsolated(id));
  return {
    schemaVersion: 1,
    protocolVersion: 'sunrey.range.v1',
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    scenarioCount: results.length,
    passed: results.filter((row) => row.passed).length,
    failed: results.filter((row) => !row.passed).length,
    invariantBreaches: invariantBreachCount(results),
    severities: countSeverities(results),
    results,
    scorecard: buildScorecard(results),
  };
}

export function runSmokeCampaign(): CampaignReport {
  return runCampaign(SMOKE_SCENARIO_IDS);
}

export function runProductionSafetySmokeCampaign(): CampaignReport {
  return runCampaign(PRODUCTION_SAFETY_SMOKE_IDS);
}

export function runProductionSafetyExtendedCampaign(): CampaignReport {
  return runCampaign(PRODUCTION_SAFETY_EXTENDED_IDS);
}

export function persistCampaign(report: CampaignReport, directory = 'artifacts/sunrey-range'): CampaignReport {
  mkdirSync(directory, { recursive: true });
  writeEvidenceArtifact(join(directory, 'campaign.json'), redact(report));
  for (const result of report.results) {
    writeEvidenceArtifact(join(directory, `${result.scenarioId}.json`), evidenceRecord(result));
  }
  writeFileSync(join(directory, 'scorecard.json'), `${JSON.stringify(report.scorecard, null, 2)}\n`);
  return report;
}
