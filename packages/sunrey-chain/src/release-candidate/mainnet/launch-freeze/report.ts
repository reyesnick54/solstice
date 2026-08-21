import type { LaunchFreezeEvaluation, LaunchFreezeStaleness } from './types.ts';

export function formatLaunchFreezeReport(
  evaluation: LaunchFreezeEvaluation,
  staleness?: LaunchFreezeStaleness,
): string {
  const freeze = evaluation.freeze;
  return [
    'PRODUCTION LAUNCH CANDIDATE FREEZE',
    `status=${freeze.status}`,
    `reviewClass=${freeze.reviewClass}`,
    `FREEZE_HASH=${freeze.freezeHash}`,
    `FLOATING_VERSIONS_PRESENT=${String(evaluation.bom.implicitVersionsPresent)}`,
    `RAW_SECRETS_PRESENT=false`,
    `PRODUCTION_PARAMETERS_COMPLETE=${String(evaluation.productionParametersComplete)}`,
    `EXTERNAL_EVIDENCE_COMPLETE=${String(evaluation.externalEvidenceComplete)}`,
    `HUMAN_AUTHORIZATION_COMPLETE=${String(evaluation.humanAuthorizationComplete)}`,
    `UNCONFIGURED_TOKENOMICS=${evaluation.unconfiguredTokenomics.join(',') || 'none'}`,
    `BLOCKERS=${freeze.blockers.join(',') || 'none'}`,
    `STALE=${staleness ? String(staleness.stale) : 'n/a'}`,
    `STALENESS_REASONS=${staleness?.reasons.join(',') || 'none'}`,
    `FREEZE_EQUALS_APPROVAL=false`,
    `FREEZE_EQUALS_ACTIVATION=false`,
    `LIVE_CONNECTIVITY_ENABLED=false`,
    `PRODUCTION_ACTIVE=false`,
    `LAUNCH_FREEZE_MAINNET_ENABLED=false`,
    `mainnetEnabled=false`,
  ].join('\n');
}
