import { SLO_IDS, SLO_LABEL, type EngineeringRecoveryObjective, type SloDefinition } from './types.ts';

export function engineeringSlos(): readonly SloDefinition[] {
  return Object.freeze([
    {
      id: 'RPC_AVAILABILITY',
      label: SLO_LABEL,
      description: 'RPC instances answer health checks.',
      target: '99.0 percent over a drill window',
    },
    {
      id: 'EXPLORER_INDEXING_LAG',
      label: SLO_LABEL,
      description: 'Explorer height stays within two finalized blocks.',
      target: 'lag <= 2 heights',
    },
    {
      id: 'BLOCK_FINALITY_PERFORMANCE',
      label: SLO_LABEL,
      description: 'Finality completes when connected voting power permits.',
      target: 'finality when connected power >= two-thirds-plus',
    },
    {
      id: 'ORACLE_FRESHNESS',
      label: SLO_LABEL,
      description: 'Oracle quorum observations remain fresh in the drill clock.',
      target: 'freshness <= 5 drill ticks',
    },
    {
      id: 'SETTLEMENT_PROCESSING',
      label: SLO_LABEL,
      description: 'Exchange settlement backlog drains after recovery.',
      target: 'pending settlements return to 0',
    },
    {
      id: 'BACKUP_SUCCESS',
      label: SLO_LABEL,
      description: 'Verified backup plus restore drill succeeds.',
      target: 'manifest and hash verification pass',
    },
    {
      id: 'PAYMENT_WORKFLOW_COMPLETION',
      label: SLO_LABEL,
      description: 'Payment workflow reaches a terminal engineering state in the drill window.',
      target: 'completion without SUBMISSION_UNKNOWN remainder',
    },
    {
      id: 'PAYMENT_SUBMISSION_UNKNOWN_RECONCILIATION',
      label: SLO_LABEL,
      description: 'SUBMISSION_UNKNOWN payments are reconciled before retry.',
      target: 'unknown submissions return to 0 after recovery conditions',
    },
    {
      id: 'PROVIDER_AVAILABILITY',
      label: SLO_LABEL,
      description: 'Provider technical health answers in the drill clock.',
      target: 'technical health is TECHNICALLY_HEALTHY',
    },
    {
      id: 'PROVIDER_CREDENTIAL_VALIDITY',
      label: SLO_LABEL,
      description: 'Provider credentials remain unexpired in the drill clock.',
      target: 'expiry horizon above the engineering warning window',
    },
    {
      id: 'ORACLE_QUORUM',
      label: SLO_LABEL,
      description: 'Oracle quorum remains available and fresh.',
      target: 'quorum available and freshness within drill ticks',
    },
    {
      id: 'EVENT_OUTBOX_DELIVERY',
      label: SLO_LABEL,
      description: 'Event outbox backlog drains after recovery.',
      target: 'outbox backlog returns to 0',
    },
    {
      id: 'PERSISTENCE_RECOVERY',
      label: SLO_LABEL,
      description: 'Primary health, replica lag, and recovery queue return to engineering targets.',
      target: 'primary healthy, replica lag 0, recovery queue 0',
    },
    {
      id: 'CUSTODY_RECONCILIATION',
      label: SLO_LABEL,
      description: 'SunRey and MoonRey custody reconciliation matches.',
      target: 'reconciliation mismatch count 0 for both assets',
    },
    {
      id: 'EXCHANGE_SETTLEMENT',
      label: SLO_LABEL,
      description: 'Exchange settlement backlog drains after recovery.',
      target: 'pending settlements return to 0',
    },
    {
      id: 'COMPLIANCE_PROVIDER_AVAILABILITY',
      label: SLO_LABEL,
      description: 'KYC, sanctions, and AML provider-candidate adapters remain technically reachable.',
      target: 'unavailable counters remain 0',
    },
  ]);
}

export function assertEngineeringLabel(slos: readonly SloDefinition[] = engineeringSlos()): void {
  for (const slo of slos) {
    if (slo.label !== SLO_LABEL) {
      throw new Error(`${slo.id} is not labeled ${SLO_LABEL}`);
    }
  }
  if (slos.length !== SLO_IDS.length) {
    throw new Error('engineering SLO catalog is incomplete');
  }
}

export function engineeringRecoveryObjectives(): readonly EngineeringRecoveryObjective[] {
  return Object.freeze([
    { component: 'BLOCKCHAIN_STATE', targetRpoMs: 60_000n, targetRtoMs: 300_000n, label: SLO_LABEL },
    { component: 'POSTGRES_APPLICATION_DATA', targetRpoMs: 120_000n, targetRtoMs: 600_000n, label: SLO_LABEL },
    { component: 'EXPLORER_INDEX', targetRpoMs: 0n, targetRtoMs: 180_000n, label: SLO_LABEL },
    { component: 'SIGNER_SAFETY', targetRpoMs: 0n, targetRtoMs: 120_000n, label: SLO_LABEL },
  ]);
}
