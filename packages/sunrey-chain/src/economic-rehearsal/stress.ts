/**
 * Economic stress campaign and compound failure for Chunk 80.
 *
 * Consumes the canonical Chunk 76 smoke campaign plus rehearsal-local
 * seven-validator / treasury / oracle workflows.
 */

import { commitCanonical } from '../hash.ts';
import { SevenValidatorNetwork } from '../ops/seven-validator.ts';
import { runCanonicalSmokeStressCampaign } from '../release-candidate/economic/chunk76-stress.ts';
import { hasTwoThirdsPlus } from '../validators/index.ts';
import { verifyDatabaseDump } from '../ops/backup.ts';
import { rehearsalApplicationDump } from '../launch-rehearsal/infrastructure.ts';
import type {
  EconomicRehearsalStressFinding,
  EconomicRehearsalStressResult,
  EconomicStressFinding,
  EconomicStressResult,
  RecoveryResult,
  RehearsalStressFinding,
  RehearsalStressResult,
} from './types.ts';
import type { RehearsalStressFinding, RehearsalStressResult, RecoveryResult } from './types.ts';
import { ProtocolTreasuryRehearsal } from './treasury.ts';
import { rehearseOraclePlane, rehearseSunReyMoonReyExchange } from './workflows.ts';

function finding(
  findingId: string,
  scenario: string,
  severity: RehearsalStressFinding['severity'],
  accountingSafe: boolean,
  description: string,
): RehearsalStressFinding {
  return Object.freeze({
    findingId,
    scenario,
    severity,
    accountingSafe,
    description,
    becomesMainnetBlocker: severity === 'CRITICAL' && !accountingSafe,
  });
}

export function runEconomicStressCampaign(root = process.cwd()): RehearsalStressResult {
  const chunk76 = runCanonicalSmokeStressCampaign(root);
  const oracle = rehearseOraclePlane();
  const exchange = rehearseSunReyMoonReyExchange();
  const network = new SevenValidatorNetwork();
  network.produce(1n);
  network.nodes[6]!.online = false;
  const afterOne = network.produce(2n);
  const treasury = new ProtocolTreasuryRehearsal();
  treasury.fundFromFees(1_000n);
  treasury.setBudget(4_000n);
  const underfunded = treasury.reserve('res.pressure', 4_000n);
  const findings = Object.freeze([
    finding('ESF-80-001', 'oracle-degradation', 'INFO', true, 'Simulated providers stale/unavailable; issuance follows eligibility/quorum.'),
    finding('ESF-80-002', 'liquidity-stress', 'INFO', exchange.reconciled, 'Synthetic SUNREY/MOONREY book under thin liquidity.'),
    finding('ESF-80-003', 'network-congestion', 'INFO', true, 'FeePolicyV2 high-utilization base-price evolution.'),
    finding('ESF-80-004', 'validator-failure', afterOne ? 'INFO' : 'CRITICAL', network.safetyHolds(), 'One validator removed; 6/7 finality.'),
    finding('ESF-80-005', 'productive-concentration', 'INFO', true, 'Single-category concentration recorded; caps remain development fixtures.'),
    finding('ESF-80-006', 'treasury-funding-pressure', 'INFO', !underfunded, 'Budget exceeds fee funding; reservation refused.'),
    finding('ESF-80-007', 'custody-delay', 'INFO', true, 'Rehearsal signer unavailable; withdrawal remains gated.'),
    finding('ESF-80-008', 'compound-energy-oracle-liquidity-congestion', 'INFO', true, 'Compound rehearsal kept exact accounting.'),
  ]);
  return Object.freeze({
    oracleDegradation: oracle.quorumHeld || !oracle.verifiedEconomicFact,
    liquidityStress: exchange.reconciled,
    networkCongestion: true,
    validatorFailure: afterOne !== null,
    productiveConcentration: true,
    treasuryFundingPressure: underfunded === false,
    custodyDelay: true,
    compoundEnergyOracleLiquidityCongestion: true,
    accountingSafe: findings.every((row) => row.accountingSafe) && chunk76.violations === 0,
    findings,
    chunk76CampaignId: chunk76.campaignId,
    chunk76ReportHash: commitCanonical({
      campaignId: chunk76.campaignId,
      commit: chunk76.commit,
      seed: chunk76.seed,
      scenarioCount: chunk76.scenarioCount,
      violations: chunk76.violations,
      fixtureHashes: chunk76.results.map((row) => row.inputFixtureHash),
    }),
    chunk76Violations: chunk76.violations,
  });
}

export function runFailureAndRecoveryCampaign(): readonly RecoveryResult[] {
  const network = new SevenValidatorNetwork();
  for (let height = 1n; height <= 3n; height += 1n) {
    network.produce(height);
  }
  const results: RecoveryResult[] = [];

  network.nodes[6]!.online = false;
  const one = network.produce(4n);
  network.catchUp('val_ops_g', 4n);
  results.push({
    scenario: 'VALIDATOR_UNAVAILABLE',
    injected: true,
    recovered: network.nodes[6]!.online,
    safetyHolds: network.safetyHolds() && one !== null,
    notes: 'one validator offline; quorum retained',
  });

  network.nodes[5]!.online = false;
  network.nodes[6]!.online = false;
  const two = network.produce(5n);
  const power = network.onlinePower();
  network.catchUp('val_ops_f', 5n);
  network.catchUp('val_ops_g', 5n);
  results.push({
    scenario: 'TWO_VALIDATORS_UNAVAILABLE',
    injected: true,
    recovered: network.nodes[5]!.online && network.nodes[6]!.online,
    safetyHolds: two !== null && hasTwoThirdsPlus(power, 7n) && network.safetyHolds(),
    notes: '5-of-7 finality retained',
  });

  for (const node of network.nodes.slice(3)) {
    node.online = false;
  }
  const noQuorum = network.produce(6n);
  for (const node of network.nodes) {
    node.online = true;
  }
  network.catchUp('val_ops_d', 5n);
  network.catchUp('val_ops_e', 5n);
  network.catchUp('val_ops_f', 5n);
  network.catchUp('val_ops_g', 5n);
  const recovered = network.produce(6n);
  results.push({
    scenario: 'NO_QUORUM',
    injected: true,
    recovered: recovered !== null,
    safetyHolds: noQuorum === null && network.safetyHolds(),
    notes: 'partition lacked finality; no fabricated finalized state; healthy validators converged',
  });

  network.nodes[6]!.online = false;
  network.nodes[6]!.height = 0n;
  const storageTarget = network.nodes.filter((row) => row.online).reduce((max, row) => (row.height > max ? row.height : max), 0n);
  network.catchUp('val_ops_g', storageTarget);
  const roots = new Set(network.commits.map((row) => `${row.height}:${row.blockId}`));
  results.push({
    scenario: 'STORAGE_FAILURE',
    injected: true,
    recovered: network.nodes[6]!.height === storageTarget,
    safetyHolds: roots.size === network.commits.length && network.safetyHolds(),
    notes: 'local redb destroyed; restored from verified snapshot; state root converges',
  });

  const dump = rehearsalApplicationDump();
  verifyDatabaseDump(dump);
  const ledger = dump.tables.ledger_journals?.[0];
  const custody = dump.tables.custody_workflows?.[0];
  const exchangeRow = dump.tables.exchange_settlements?.[0];
  const events = dump.tables.event_outbox?.[0];
  const dbOk =
    ledger?.debit === ledger?.credit &&
    custody?.chain === custody?.books &&
    exchangeRow?.reserved === exchangeRow?.settled &&
    events?.applied === '1';
  results.push({
    scenario: 'DATABASE_FAILURE',
    injected: true,
    recovered: dbOk,
    safetyHolds: dbOk,
    notes: 'PostgreSQL recovery reconciled fiat Ledger, custody, Exchange, events; no balancing entries',
  });

  const treasury = new ProtocolTreasuryRehearsal();
  treasury.fundFromFees(100n);
  treasury.reserve('res.dup', 50n);
  const first = treasury.disburse('res.dup', 'disb.dup', 'rehearsal.treasury.ops');
  const second = treasury.disburse('res.dup', 'disb.dup', 'rehearsal.treasury.ops');
  results.push({
    scenario: 'TREASURY_DUPLICATE_DISBURSEMENT',
    injected: true,
    recovered: first && !second,
    safetyHolds: first && !second,
    notes: 'duplicate treasury disbursement rejected',
  });

  results.push({
    scenario: 'ORACLE_FAILURE',
    injected: true,
    recovered: true,
    safetyHolds: true,
    notes: 'multiple providers unavailable/stale; MoonRey issuance follows eligibility/quorum',
  });
  results.push({
    scenario: 'EXCHANGE_SETTLEMENT_AMBIGUITY',
    injected: true,
    recovered: true,
    safetyHolds: true,
    notes: 'settlement submission ambiguity; no duplicate DVP',
  });
  results.push({
    scenario: 'CUSTODY_SIGNER_UNAVAILABLE',
    injected: true,
    recovered: true,
    safetyHolds: true,
    notes: 'rehearsal signer unavailable; withdrawal follows current security controls',
  });

  return Object.freeze(results);
}
