/**
 * HELIOS Multi-Asset Expansion M28 — top-level release candidate qualification.
 */

import {
  HELIOS_MULTI_ASSET_PAPER_RC_BLOCKED,
  HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED,
} from './taxonomy.ts';
import type { M28ReleaseManifest } from './manifest.ts';

export type M28QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_PAPER_RC_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly manifest: M28ReleaseManifest;
};

export function evaluateM28ReleaseQualification(manifest: M28ReleaseManifest): M28QualificationResult {
  const blockers: string[] = [...manifest.blockers];

  if (manifest.liveFinancialFlag !== false) {
    blockers.push('liveFinancialFlag must remain false');
  }

  if (!manifest.forwardPaperResults.qualified) {
    blockers.push(
      `forward-paper scenarios: ${manifest.forwardPaperResults.failedCount} failed of ${manifest.forwardPaperResults.scenarios.length}`,
    );
  }

  for (const gate of manifest.releaseGates) {
    if (
      gate.gateId === 'LIVE_FINANCIAL_AUTHORIZATION' &&
      gate.status !== 'OFF'
    ) {
      blockers.push('LIVE_FINANCIAL_AUTHORIZATION not OFF');
    }
    if (
      ['ARCHITECTURE', 'TYPECHECK', 'TEST_SUITE', 'DATABASE_MIGRATIONS', 'PERSISTENCE', 'RESTART_SAFETY', 'CUSTOMER_ISOLATION', 'SECURITY', 'PRODUCTION_SAFETY_FLAGS', 'PORTFOLIO_RISK', 'RECONCILIATION', 'GROW_CONTRACT', 'RESILIENCE'].includes(
        gate.gateId,
      ) &&
      gate.status === 'FAIL'
    ) {
      blockers.push(`${gate.gateId}:FAIL`);
    }
  }

  const uniqueBlockers = Object.freeze([...new Set(blockers)]);
  const qualified = uniqueBlockers.length === 0;

  return Object.freeze({
    marker: qualified ? HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED : HELIOS_MULTI_ASSET_PAPER_RC_BLOCKED,
    qualified,
    blockers: uniqueBlockers,
    manifest: Object.freeze({
      ...manifest,
      marker: qualified ? HELIOS_MULTI_ASSET_PAPER_RC_QUALIFIED : HELIOS_MULTI_ASSET_PAPER_RC_BLOCKED,
      qualified,
      blockers: uniqueBlockers,
    }),
  });
}
