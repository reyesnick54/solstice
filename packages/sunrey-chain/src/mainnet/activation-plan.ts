/**
 * Future ActivationPlan generation.
 *
 * Plan generation is safe while evidence remains incomplete.
 * The plan does not launch validators, publish genesis, or enable LIVE_*.
 */

import { CAPABILITIES } from '../../../config/src/flags.ts';
import type { ActivationPlan, ActivationPlanStep, ReadinessEvidenceRecord } from './types.ts';
import { missingEvidenceIds } from './evidence.ts';

const STEP_TITLES = [
  ['release-artifact-verification', 'Verify release artifacts, SBOM, provenance, and signatures'],
  ['key-ceremony-verification', 'Verify root-of-trust ceremony transcript and public descriptors'],
  ['genesis-verification', 'Verify candidate genesis hash, validator set, and allocation'],
  ['validator-configuration', 'Configure validator candidates from the approved manifest'],
  ['network-launch-sequence', 'Human-controlled network launch sequence (not executed here)'],
  ['rpc-explorer-availability', 'Bring up RPC and Explorer after genesis publication'],
  ['observability', 'Enable observability and incident telemetry'],
  ['incident-command', 'Stand up incident command and paging'],
  ['capability-enablement', 'Enable each production capability only after its own approvals'],
] as const;

export function generateActivationPlan(
  records: readonly ReadinessEvidenceRecord[],
  generatedAtUtc = '2026-01-01T00:00:00.000Z',
): ActivationPlan {
  const steps: ActivationPlanStep[] = STEP_TITLES.map(([id, title], index) =>
    Object.freeze({
      order: index + 1,
      id,
      title,
      status: 'PLANNED',
      executesInfrastructure: false,
      notes: 'Plan only. A separate future human-controlled activation procedure is required.',
    }),
  );
  return Object.freeze({
    schemaVersion: 1,
    generatedAtUtc,
    executes: false,
    launchesValidators: false,
    publishesGenesis: false,
    enablesLiveFlags: false,
    migratesCustomerFunds: false,
    opensExchangeTrading: false,
    enablesCustodyWithdrawals: false,
    steps: Object.freeze(steps),
    incompleteEvidence: missingEvidenceIds(records),
  });
}

export function activationPlanDoesNotEnableLiveFlags(plan: ActivationPlan): boolean {
  return (
    plan.executes === false &&
    plan.enablesLiveFlags === false &&
    plan.launchesValidators === false &&
    plan.publishesGenesis === false &&
    CAPABILITIES.ENVIRONMENT === 'simulation' &&
    CAPABILITIES.LIVE_EXCHANGE_ENABLED === false &&
    CAPABILITIES.LIVE_MONEY_ENABLED === false
  );
}
