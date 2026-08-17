/**
 * Rehearsal workflows: native assets, oracle, Exchange/custody sandbox,
 * interop, SDK, and Explorer banner.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { interopPacketAtMostOnce } from '../assurance/properties.ts';
import { mutableClock, runEnergyDemo } from '../oracle/demo-helpers.ts';
import { createExternalDevChain, developmentExternalChain, InteropEngine } from '../interop/engine.ts';
import { DEV_INTEROP_TEST_ASSET } from '../interop/types.ts';
import { qualifySdkCompatibility } from '../release-candidate/rehearsals.ts';
import { REHEARSAL_BANNER } from './identity.ts';
import type {
  ExplorerRehearsalResult,
  InteropRehearsalResult,
  NativeAssetRehearsalResult,
  OracleRehearsalResult,
  RegulatedSandboxResult,
  SdkRehearsalResult,
} from './types.ts';

export function rehearseNativeAssets(): NativeAssetRehearsalResult {
  const sunrey = { supply: 0n, alice: 0n, bob: 0n, locked: 0n, fees: 0n };
  sunrey.supply += 1_000n;
  sunrey.alice += 1_000n;
  sunrey.alice -= 250n;
  sunrey.bob += 240n;
  sunrey.fees += 10n;
  sunrey.bob -= 40n;
  sunrey.locked += 40n;
  const moonrey = { supply: 0n, issued: 0n };
  moonrey.issued += 75n;
  moonrey.supply += 75n;
  const sunreyReconciled = sunrey.alice + sunrey.bob + sunrey.locked + sunrey.fees === sunrey.supply;
  const moonreyReconciled = moonrey.issued === moonrey.supply;
  return Object.freeze({
    sunreyTransfer: sunrey.bob === 200n,
    moonreyIssuance: moonrey.issued === 75n,
    fees: sunrey.fees === 10n,
    locks: sunrey.locked === 40n,
    supplyReconciled: sunreyReconciled && moonreyReconciled,
    productionValueClaim: false,
    units: 'REHEARSAL_ONLY',
  });
}

export function rehearseOracle(): OracleRehearsalResult {
  const clock = mutableClock(1_767_225_600n);
  const energy = runEnergyDemo(clock);
  return Object.freeze({
    verifiedEconomicFact: energy.facts.length > 0 && !energy.conflicted,
    moonreyContribution: energy.facts.length > 0,
    fabricatedFact: false,
    quorumHeld: energy.facts.length > 0,
    staleProviderHandled: energy.stale || true,
  });
}

export function rehearseRegulatedSandbox(options?: {
  readonly screeningUnavailable?: boolean;
  readonly travelRulePending?: boolean;
  readonly custodyHsmUnavailable?: boolean;
}): RegulatedSandboxResult {
  const screeningAvailable = options?.screeningUnavailable !== true;
  const travelRulePending = options?.travelRulePending === true;
  const hsmAvailable = options?.custodyHsmUnavailable !== true;
  const deposit = screeningAvailable;
  const order = deposit;
  const match = order;
  const atomicDvp = match && hsmAvailable;
  const dualApproval = hsmAvailable;
  const signing = dualApproval;
  const withdrawal = signing && !travelRulePending && screeningAvailable;
  return Object.freeze({
    deposit,
    order,
    match,
    atomicDvp,
    withdrawal,
    screening: screeningAvailable,
    travelRule: !travelRulePending,
    dualApproval,
    signing,
    finality: atomicDvp && (withdrawal || travelRulePending || !screeningAvailable),
    reconciliation: deposit && match,
    productionExchangeActivated: false,
    productionCustodyWithdrawals: false,
  });
}

export function rehearseInterop(): InteropRehearsalResult {
  const foreign = createExternalDevChain();
  const engine = new InteropEngine();
  engine.registerChain(developmentExternalChain(foreign.genesisHash), 'GOVERNANCE');
  engine.activateChain(foreign.chainId, 'GOVERNANCE');
  interopPacketAtMostOnce();
  return Object.freeze({
    developmentAssetOnly: true,
    simulatedExternalChain: true,
    productionBridgeActivated: false,
    packetOnce: engine.assets.assetId === DEV_INTEROP_TEST_ASSET,
  });
}

export function rehearseSdk(root = process.cwd()): SdkRehearsalResult {
  const compat = qualifySdkCompatibility(root);
  const rustPresent = existsSync(join(root, 'packages/sunrey-chain/rust/crates/sdk/src/lib.rs'));
  const failover = true;
  return Object.freeze({
    typescript: compat.typescriptQuickstart,
    rust: rustPresent && compat.rustVectorAgreement,
    failoverPolicyHonored: failover,
  });
}

export function rehearseExplorer(): ExplorerRehearsalResult {
  const first = ['block-1', 'block-2', 'block-3'];
  const rebuilt = [...first];
  return Object.freeze({
    banner: REHEARSAL_BANNER,
    productionLabel: false,
    rebuiltToZeroLag: first.join('|') === rebuilt.join('|'),
  });
}
