/**
 * HELIOS Multi-Asset Expansion M28 — machine-readable release manifest builder.
 */

import { createHash } from 'node:crypto';

import {
  ENVIRONMENT,
  LIVE_CONNECTIVITY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '@solstice/config';
import {
  buildHeliosMigrationInventory,
  migrationChecksumManifest,
  schemaMigrationHeads,
} from '../../release-packaging/migration-inventory.ts';
import { M28_M20_RISK_POLICY_VERSION } from './m20-qualification-shim.ts';
import { generateM05M08CoverageReport } from '../data-coverage/m05-m08-report.ts';
import type { M28EconomicSummary } from './economic-summary.ts';
import type { M28ForwardPaperQualificationResult } from './forward-paper-scenarios.ts';
import type { M28MilestoneRegistry } from './milestone-registry.ts';
import type { M28PerformanceMeasurement } from './performance-measurement.ts';
import type { M28ReleaseGateEvaluation } from './gates.ts';
import {
  HELIOS_MULTI_ASSET_RELEASE_CANDIDATE_SCHEMA,
  HELIOS_MULTI_ASSET_RELEASE_SEQUENCE,
  HELIOS_MULTI_ASSET_RELEASE_WORK_PACKAGE,
  type M28MilestoneQualificationState,
} from './taxonomy.ts';

export type M28ReleaseManifest = {
  readonly schema: typeof HELIOS_MULTI_ASSET_RELEASE_CANDIDATE_SCHEMA;
  readonly releaseId: string;
  readonly gitSha: string;
  readonly buildTimestampUtc: string;
  readonly sequence: typeof HELIOS_MULTI_ASSET_RELEASE_SEQUENCE;
  readonly workPackage: typeof HELIOS_MULTI_ASSET_RELEASE_WORK_PACKAGE;
  readonly liveFinancialFlag: false;
  readonly safetyPosture: Readonly<Record<string, boolean | string>>;
  readonly milestoneQualification: Readonly<Record<string, M28MilestoneQualificationState>>;
  readonly databaseMigrationState: Readonly<Record<string, string>>;
  readonly migrationChecksums: Readonly<Record<string, string>>;
  readonly strategyVersions: Readonly<Record<string, string>>;
  readonly providerCapabilityStates: Readonly<Record<string, string>>;
  readonly marketDataStates: Readonly<Record<string, string>>;
  readonly executionStates: Readonly<Record<string, string>>;
  readonly riskPolicyVersion: string;
  readonly compliancePolicyVersion: string;
  readonly releaseGates: M28ReleaseGateEvaluation['gates'];
  readonly testResults: Readonly<Record<string, boolean>>;
  readonly typecheckDetail: string | null;
  readonly forwardPaperResults: M28ForwardPaperQualificationResult;
  readonly resilienceResults: Readonly<Record<string, unknown>>;
  readonly performanceResults: M28PerformanceMeasurement;
  readonly economicEvaluation: M28EconomicSummary;
  readonly externalBlockers: readonly string[];
  readonly marker: string;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function buildM28ReleaseManifest(input: {
  readonly repoRoot: string;
  readonly gitSha: string;
  readonly buildTimestampUtc: string;
  readonly milestoneRegistry: M28MilestoneRegistry;
  readonly gateEvaluation: M28ReleaseGateEvaluation;
  readonly forwardPaper: M28ForwardPaperQualificationResult;
  readonly performance: M28PerformanceMeasurement;
  readonly economic: M28EconomicSummary;
  readonly testResults: Readonly<Record<string, boolean>>;
  readonly typecheckDetail?: string | null;
  readonly marker: string;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
}): M28ReleaseManifest {
  const shortSha = input.gitSha.slice(0, 12);
  const coverage = generateM05M08CoverageReport(input.buildTimestampUtc);
  const schemaHeads = schemaMigrationHeads(input.repoRoot);
  const migrationChecksums = migrationChecksumManifest(input.repoRoot);
  buildHeliosMigrationInventory(input.repoRoot);

  const milestoneQualification = Object.fromEntries(
    input.milestoneRegistry.milestones.map((m) => [m.milestoneId, m.state]),
  ) as Record<string, M28MilestoneQualificationState>;

  const marketDataStates = Object.fromEntries(
    coverage.assetClasses.map((row) => [row.assetClass, row.status]),
  );

  return Object.freeze({
    schema: HELIOS_MULTI_ASSET_RELEASE_CANDIDATE_SCHEMA,
    releaseId: `helios-multi-asset-paper-rc-m28-${shortSha}`,
    gitSha: input.gitSha,
    buildTimestampUtc: input.buildTimestampUtc,
    sequence: HELIOS_MULTI_ASSET_RELEASE_SEQUENCE,
    workPackage: HELIOS_MULTI_ASSET_RELEASE_WORK_PACKAGE,
    liveFinancialFlag: false as const,
    safetyPosture: Object.freeze({
      ENVIRONMENT,
      LIVE_TRADING_ENABLED,
      LIVE_CONNECTIVITY_ENABLED,
      LIVE_INVESTMENT_EXECUTION,
    }),
    milestoneQualification,
    databaseMigrationState: schemaHeads,
    migrationChecksums,
    strategyVersions: Object.freeze({
      M09: 'HELIOS_M09_INDEX_MEAN_REVERSION_V1',
      M10: 'HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1',
      M11: 'HELIOS_M11_COMMODITY_TREND_FOLLOWING_V1',
      M12: 'HELIOS_M12_RELATIVE_VALUE_STAT_ARB_V1',
    }),
    providerCapabilityStates: Object.freeze({
      finnhub: 'adapter_ready',
      coingecko: 'simulation_only',
      helios_wti_sandbox: 'qualified',
      sunrey_market_reference: 'simulation_only',
      external_live: 'blocked',
    }),
    marketDataStates,
    executionStates: Object.freeze({
      paperGrow: 'qualified',
      orderLifecycle: 'simulation_qualified',
      liveExecution: 'blocked',
      reconciliation: 'simulation_qualified',
    }),
    riskPolicyVersion: M28_M20_RISK_POLICY_VERSION,
    compliancePolicyVersion: 'jurisdiction-capability-v1',
    releaseGates: input.gateEvaluation.gates,
    testResults: input.testResults,
    typecheckDetail: input.typecheckDetail ?? null,
    forwardPaperResults: input.forwardPaper,
    resilienceResults: Object.freeze({
      tier: 'FAST_CI',
      note: 'See H31 qualification for full scenario catalog',
    }),
    performanceResults: input.performance,
    economicEvaluation: input.economic,
    externalBlockers: Object.freeze([
      'Live market-data provider certification incomplete for equities (FINNHUB optional)',
      'Live crypto execution rails not connected',
      'Live gold/Oil NYMEX feeds not connected',
      'Legal/regulatory corridor activation matrix CLOSED',
      'Custody/ledger reconciliation production binding inactive',
    ]),
    marker: input.marker,
    qualified: input.qualified,
    blockers: input.blockers,
  });
}

export function manifestDigest(manifest: M28ReleaseManifest): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(manifest)).digest('hex')}`;
}
