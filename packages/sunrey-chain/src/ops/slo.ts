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
