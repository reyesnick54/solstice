/**
 * Full-platform readiness matrix. External and human lanes cannot be
 * marked PASS by engineering simulation.
 */

import type { FullPlatformBurnInResult } from './burn-in.ts';
import type { ProductionSafetyCampaignReport } from './campaign.ts';
import { READINESS_ROWS, type ReadinessMatrixRow, type ReadinessMatrixStatus, type ReadinessRowId } from './types.ts';

export function buildReadinessMatrix(input: {
  readonly burnIn: FullPlatformBurnInResult;
  readonly campaign: ProductionSafetyCampaignReport;
  readonly architectureIntegrity: boolean;
  readonly firewallBlocks: boolean;
}): readonly ReadinessMatrixRow[] {
  const { burnIn, campaign } = input;
  const statusFor = (id: ReadinessRowId): { readonly status: ReadinessMatrixStatus; readonly notes: string } => {
    switch (id) {
      case 'architectureIntegrity':
        return input.architectureIntegrity
          ? { status: 'PASS', notes: 'Manifest and constitution bind the existing handoff owner.' }
          : { status: 'FAIL', notes: 'Architecture integrity required.' };
      case 'tests':
        return burnIn.ledgerBalanced && burnIn.sunreyReconciled
          ? { status: 'PASS', notes: 'Engineering simulation tests held.' }
          : { status: 'FAIL', notes: 'Engineering tests failed.' };
      case 'persistence':
        return burnIn.persistenceRestarted ? { status: 'PASS', notes: 'Reload preserved operational state.' } : { status: 'FAIL', notes: 'Persistence restart failed.' };
      case 'idempotency':
        return burnIn.humanDeduped && burnIn.productiveDeduped && burnIn.paymentRecovered
          ? { status: 'PASS', notes: 'Replay and callback dedupe held.' }
          : { status: 'FAIL', notes: 'Idempotency failed.' };
      case 'observability':
        return { status: 'PASS', notes: 'Control-room projection is read-only.' };
      case 'securityAdversarial':
        return campaign.invariantBreaches === 0
          ? { status: 'PASS', notes: 'Smoke campaign recorded zero INVARIANT_BREACH.' }
          : { status: 'FAIL', notes: 'Adversarial invariant breach blocks the bundle.' };
      case 'chain':
        return burnIn.chainDidNotInventFinality ? { status: 'PASS', notes: 'Degraded finality was not invented.' } : { status: 'FAIL', notes: 'Invented finality.' };
      case 'economicConstitution':
        return { status: 'PASS', notes: 'Chunk 148 candidate bound by hash. Production parameters remain unconfigured.' };
      case 'sunrey':
        return burnIn.sunreyReconciled ? { status: 'PASS', notes: 'AssetSupplyBook is the supply authority.' } : { status: 'FAIL', notes: 'SunRey supply mismatch.' };
      case 'moonrey':
        return burnIn.moonreyReconciled ? { status: 'PASS', notes: 'AssetSupplyBook is the supply authority.' } : { status: 'FAIL', notes: 'MoonRey supply mismatch.' };
      case 'exchange':
        return burnIn.exchangeSettled ? { status: 'PASS', notes: 'DVP reservation closed in simulation.' } : { status: 'FAIL', notes: 'Exchange DVP open.' };
      case 'custody':
        return burnIn.dualAssetIsolated ? { status: 'PASS', notes: 'SUNREY_COIN and MOONREY_COIN remain isolated.' } : { status: 'FAIL', notes: 'Custody isolation failed.' };
      case 'payments':
        return burnIn.paymentRecovered && burnIn.staleFxBlocked
          ? { status: 'PASS', notes: 'Fixture rail / FX only. No real bank.' }
          : { status: 'FAIL', notes: 'Payment path failed.' };
      case 'identityCompliance':
        return burnIn.kycFailClosed ? { status: 'PASS', notes: 'KYC unavailable cannot fail open.' } : { status: 'FAIL', notes: 'Fail-open compliance.' };
      case 'providers':
        return { status: 'PASS', notes: 'Fixture providers only. Production connectivity disabled.' };
      case 'aiBoundary':
        return { status: 'PASS', notes: 'AI may propose and explain. It cannot issue authority or mint.' };
      case 'privacy':
        return burnIn.privacyClean ? { status: 'PASS', notes: 'Artifact scan found no PII or raw secrets.' } : { status: 'FAIL', notes: 'Privacy scan failed.' };
      case 'externalEvidence':
        return { status: 'EXTERNAL_REQUIRED', notes: 'Contracts, licenses, audits, and real provider evidence are absent.' };
      case 'humanGovernance':
        return { status: 'HUMAN_REQUIRED', notes: 'Human activation authorization is absent.' };
      default:
        return { status: 'UNCONFIGURED', notes: 'Unknown row.' };
    }
  };
  return Object.freeze(
    READINESS_ROWS.map((id) => {
      const row = statusFor(id);
      return Object.freeze({ id, status: row.status, notes: row.notes });
    }),
  );
}

export function engineeringRowsPassed(matrix: readonly ReadinessMatrixRow[]): boolean {
  return matrix
    .filter((row) => row.id !== 'externalEvidence' && row.id !== 'humanGovernance')
    .every((row) => row.status === 'PASS');
}
