/**
 * demo:sunrey-staged-activation
 *
 * Rehearse Stage 0 consensus health, Stage 1 read-only public surfaces,
 * and Stage 2 native-asset base. Then attempt MoonRey issuance with
 * oracle degraded: BLOCKED. Unrelated safe read-only domains remain
 * healthy. Nothing is LIVE.
 */

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../../../config/src/flags.ts';
import {
  applyAdvance,
  initialSequencerState,
} from './advance.ts';
import { evaluateDomainGates, failedGates } from './gates.ts';
import { healthyChainObservation, withOracleDegraded } from './fixtures.ts';
import { evaluateStagedActivation, rehearsalFlags } from './report.ts';

export function runStagedActivationDemo(): void {
  let state = initialSequencerState();
  const healthy = healthyChainObservation();

  const stage0 = applyAdvance(
    state,
    {
      fromStage: 'STAGE_0_GENESIS_AND_CONSENSUS',
      toStage: 'STAGE_1_READ_ONLY_PUBLIC_SURFACES',
      actorKind: 'HUMAN',
      actorId: 'human_rehearsal_operator',
    },
    healthy,
  );
  state = stage0.state;

  const stage1 = applyAdvance(
    state,
    {
      fromStage: 'STAGE_1_READ_ONLY_PUBLIC_SURFACES',
      toStage: 'STAGE_2_NATIVE_ASSET_BASE',
      actorKind: 'HUMAN',
      actorId: 'human_rehearsal_operator',
    },
    healthy,
  );
  state = stage1.state;

  const degraded = withOracleDegraded(healthy);
  const moonrey = failedGates(evaluateDomainGates('MOONREY_COIN_ISSUANCE', degraded));
  const report = evaluateStagedActivation(degraded, state);
  const chain = report.domains.find((row) => row.domain === 'SUNREY_CHAIN');
  const flags = rehearsalFlags(report);
  const liveEnabled =
    LIVE_MONEY_ENABLED ||
    LIVE_PAYMENTS_ENABLED ||
    LIVE_BANKING_RAILS ||
    LIVE_EXTERNAL_BANK_CONNECTION ||
    LIVE_EXCHANGE_ENABLED;

  console.log('SUNREY STAGED CAPABILITY ACTIVATION REHEARSAL');
  console.log(`STAGE_0_CONSENSUS_HEALTHY=${String(stage0.result.ok)}`);
  console.log(`STAGE_1_READ_ONLY_PUBLIC_SURFACES=${String(stage1.result.ok && healthy.publicSurfaces.rpcReadOnlyReady)}`);
  console.log(`STAGE_2_NATIVE_ASSET_BASE=${String(healthy.nativeAssets.sunreyExistsInProtocol)}`);
  console.log(`MOONREY_ISSUANCE_ATTEMPT=${moonrey.length > 0 ? 'BLOCKED' : 'UNEXPECTED'}`);
  console.log(`MOONREY_BLOCK_REASON=${moonrey[0]?.reason ?? 'none'}`);
  console.log(`READ_ONLY_DOMAIN_HEALTHY=${String(chain?.state !== 'BLOCKED')}`);
  console.log(`ENVIRONMENT=${ENVIRONMENT}`);
  console.log(`ALL_AT_ONCE_ACTIVATION=${String(flags.ALL_AT_ONCE_ACTIVATION)}`);
  console.log(`READ_ONLY_EQUALS_FINANCIAL_ACTIVATION=${String(flags.READ_ONLY_EQUALS_FINANCIAL_ACTIVATION)}`);
  console.log(`SUNREY_ISSUANCE_INDEPENDENT=${String(flags.SUNREY_ISSUANCE_INDEPENDENT)}`);
  console.log(`MOONREY_ISSUANCE_INDEPENDENT=${String(flags.MOONREY_ISSUANCE_INDEPENDENT)}`);
  console.log(`DOMAIN_FAILURE_MINIMALLY_SCOPED=${String(flags.DOMAIN_FAILURE_MINIMALLY_SCOPED)}`);
  console.log(`CANARY_REAL_CUSTOMERS=${String(flags.CANARY_REAL_CUSTOMERS)}`);
  console.log(`AI_CAN_ADVANCE_STAGE=${String(flags.AI_CAN_ADVANCE_STAGE)}`);
  console.log(`LIVE_FLAGS_ENABLED=${String(liveEnabled)}`);
  console.log(`PRODUCTION_ACTIVE=${String(flags.PRODUCTION_ACTIVE)}`);
}

runStagedActivationDemo();
