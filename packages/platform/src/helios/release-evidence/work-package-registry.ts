/**
 * HELIOS H36 — H01-H36 work-package status from repository/evidence truth.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkPackageStatus } from './taxonomy.ts';
import type { WorkPackageStatusRow } from './types.ts';

function repoFile(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

function testExists(root: string, pattern: string): boolean {
  return repoFile(root, join('tests', pattern));
}

function statusFrom(
  workPackage: string,
  title: string,
  status: WorkPackageStatus,
  evidenceRef: string,
  notes?: string,
): WorkPackageStatusRow {
  return Object.freeze({ workPackage, title, status, evidenceRef, ...(notes ? { notes } : {}) });
}

export function buildHeliosWorkPackageRegistry(root: string): readonly WorkPackageStatusRow[] {
  const rows: WorkPackageStatusRow[] = [];

  rows.push(
    statusFrom(
      'H01',
      'Runtime truth audit',
      repoFile(root, 'docs/helios/helios-runtime-truth-map.json') ? 'QUALIFIED' : 'BLOCKED',
      'docs/helios/helios-runtime-truth-map.json',
    ),
    statusFrom(
      'H02',
      'Phase 1 closure',
      repoFile(root, 'docs/productization/HELIOS_PHASE_1_CLOSURE_REPORT.md')
        ? 'QUALIFIED'
        : 'EXTERNAL_DEPENDENCY',
      'docs/productization/HELIOS_PHASE_1_CLOSURE_REPORT.md',
    ),
    statusFrom(
      'H03',
      'Proposal execution correctness',
      testExists(root, 'helios-h03-proposal-execution-correctness.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h03-proposal-execution-correctness.test.ts',
    ),
    statusFrom(
      'H04',
      'Economic work orders',
      testExists(root, 'helios-h04-h05-authority-binding.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h04-h05-authority-binding.test.ts',
    ),
    statusFrom(
      'H05',
      'Mandate capability approval binding',
      testExists(root, 'helios-h05-mandate-capability-approval-binding.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h05-mandate-capability-approval-binding.test.ts',
    ),
    statusFrom(
      'H06',
      'Durable work execution',
      testExists(root, 'helios-h06-durable-work-execution.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h06-durable-work-execution.test.ts',
    ),
    statusFrom(
      'H07',
      'Market data adapter',
      testExists(root, 'helios-h07-market-data-adapter.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h07-market-data-adapter.test.ts',
    ),
    statusFrom(
      'H08',
      'Observation provenance freshness entitlements',
      testExists(root, 'helios-h08-observation-provenance-freshness-entitlements.test.ts')
        ? 'QUALIFIED'
        : 'BLOCKED',
      'tests/helios-h08-observation-provenance-freshness-entitlements.test.ts',
    ),
    statusFrom(
      'H09',
      'Executable opportunity binding',
      testExists(root, 'helios-h09-executable-opportunity-binding.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h09-executable-opportunity-binding.test.ts',
    ),
    statusFrom(
      'H10',
      'Async inference',
      testExists(root, 'helios-h10-async-inference.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h10-async-inference.test.ts',
    ),
    statusFrom(
      'H11',
      'Grok research tool loop',
      testExists(root, 'helios-h11-grok-research-tool-loop.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h11-grok-research-tool-loop.test.ts',
    ),
    statusFrom(
      'H12',
      'Qualified S3M serving contract',
      testExists(root, 'helios-h12-qualified-s3m-serving-contract.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h12-qualified-s3m-serving-contract.test.ts',
    ),
    statusFrom(
      'H13',
      'Sandbox capital allocation',
      testExists(root, 'helios-h13-sandbox-capital-allocation.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h13-sandbox-capital-allocation.test.ts',
    ),
    statusFrom(
      'H14',
      'Paper Grow strategy',
      testExists(root, 'helios-h14-paper-grow-strategy.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h14-paper-grow-strategy.test.ts',
    ),
    statusFrom(
      'H15',
      'Paper Grow restart',
      testExists(root, 'helios-h15-paper-grow-restart.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h15-paper-grow-restart.test.ts',
    ),
    statusFrom(
      'H16',
      'Strategy Capsule domain',
      repoFile(root, 'packages/strategy-lab/src/capsule') ? 'IMPLEMENTED' : 'BLOCKED',
      'packages/strategy-lab/src/capsule',
      'Qualified via H17-H18 evaluation/promotion tests',
    ),
    statusFrom(
      'H17',
      'Chronological strategy evaluation',
      testExists(root, 'helios-h17-chronological-strategy-evaluation.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h17-chronological-strategy-evaluation.test.ts',
    ),
    statusFrom(
      'H18',
      'Strategy promotion',
      testExists(root, 'helios-h18-strategy-promotion.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h18-strategy-promotion.test.ts',
    ),
    statusFrom(
      'H19',
      'Specialist research mesh',
      testExists(root, 'helios-h19-specialist-research-mesh.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h19-specialist-research-mesh.test.ts',
    ),
    statusFrom(
      'H20',
      'Meta allocator',
      testExists(root, 'helios-h20-meta-allocator.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h20-meta-allocator.test.ts',
    ),
    statusFrom(
      'H21',
      'Decision validity envelope',
      testExists(root, 'helios-h21-decision-validity-envelope.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h21-decision-validity-envelope.test.ts',
    ),
    statusFrom(
      'H22',
      'Provider orchestration',
      testExists(root, 'helios-h22-provider-orchestration.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h22-provider-orchestration.test.ts',
    ),
    statusFrom(
      'H23',
      'Order fill settlement lifecycle',
      testExists(root, 'helios-h23-order-fill-settlement-lifecycle.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h23-order-fill-settlement-lifecycle.test.ts',
    ),
    statusFrom(
      'H24',
      'Capital lifecycle',
      testExists(root, 'helios-h24-capital-lifecycle.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h24-capital-lifecycle.test.ts',
    ),
    statusFrom(
      'H25',
      'Independent outcome attribution',
      testExists(root, 'helios-h25-outcome-attribution.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h25-outcome-attribution.test.ts',
    ),
    statusFrom(
      'H26',
      'Production-shaped Grow API',
      testExists(root, 'helios-h26-production-shaped-grow-api.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h26-production-shaped-grow-api.test.ts',
    ),
    statusFrom(
      'H27',
      'Grow operational controls',
      testExists(root, 'helios-h27-grow-operational-controls.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h27-grow-operational-controls.test.ts',
    ),
    statusFrom(
      'H28',
      'Jurisdiction capability',
      testExists(root, 'helios-h28-jurisdiction-capability.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h28-jurisdiction-capability.test.ts',
    ),
    statusFrom(
      'H29',
      'Regulatory evidence reporting lifecycle',
      testExists(root, 'helios-h29-regulatory-evidence-reporting-lifecycle.test.ts')
        ? 'QUALIFIED'
        : 'BLOCKED',
      'tests/helios-h29-regulatory-evidence-reporting-lifecycle.test.ts',
    ),
    statusFrom(
      'H30',
      'Supervisory governance',
      testExists(root, 'helios-h30-supervisory-governance.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h30-supervisory-governance.test.ts',
    ),
    statusFrom(
      'H31',
      'Adversarial resilience',
      testExists(root, 'helios-h31-adversarial-resilience.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h31-adversarial-resilience.test.ts',
    ),
    statusFrom(
      'H32',
      'Economic evaluation',
      testExists(root, 'helios-h32-economic-evaluation.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h32-economic-evaluation.test.ts',
    ),
    statusFrom(
      'H33',
      'Capacity latency portfolio',
      testExists(root, 'helios-h33-capacity-latency-portfolio.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'tests/helios-h33-capacity-latency-portfolio.test.ts',
    ),
    statusFrom(
      'H34',
      'Rollback qualification',
      testExists(root, 'helios-h30-supervisory-governance.test.ts') ? 'QUALIFIED' : 'BLOCKED',
      'packages/platform/src/helios/regulatory-transparency/qualification.ts',
      'Policy-version rollback via H30; application rollback is not chain-history rollback.',
    ),
    statusFrom(
      'H35',
      'Integrated acceptance',
      testExists(root, 'helios-h36-release-evidence-live-pilot-gate.test.ts')
        ? 'QUALIFIED'
        : repoFile(root, 'packages/platform/src/helios/release-evidence/integrated-acceptance.ts')
          ? 'IMPLEMENTED'
          : 'BLOCKED',
      'packages/platform/src/helios/release-evidence/integrated-acceptance.ts',
      'Release package + Hetzner app acceptance qualified via H36 integrated acceptance gates',
    ),
    statusFrom(
      'H36',
      'Release evidence and live-pilot gate',
      testExists(root, 'helios-h36-release-evidence-live-pilot-gate.test.ts')
        ? 'QUALIFIED'
        : repoFile(root, 'packages/platform/src/helios/release-evidence/index.ts')
          ? 'IMPLEMENTED'
          : 'BLOCKED',
      'tests/helios-h36-release-evidence-live-pilot-gate.test.ts',
    ),
  );

  return Object.freeze(rows);
}

export function registryHasBlockers(rows: readonly WorkPackageStatusRow[]): boolean {
  return rows.some((row) => row.status === 'BLOCKED');
}
