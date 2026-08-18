/**
 * Isolated 86–90 production lifecycle rehearsal.
 *
 * Covers production plan, pre-genesis qualification, ceremony,
 * authorized genesis rehearsal, first block, stabilization,
 * capability evidence, operator handoff, and evidence seal.
 *
 * Uses isolated environment and identities. Does not fabricate a
 * real production launch.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../../config/src/flags.ts';
import { runProductionGenesisCeremonyDressRehearsal } from '../production-ceremony/dress-rehearsal.ts';
import { consumeCandidateV2, consumeMainnetRc, consumeProviderAcceptance, consumeAuditEvidence } from '../production-ceremony/bindings.ts';
import { emptyMoonReySupply, supplyReconciles as moonreySupplyReconciles } from '../productive/supply.ts';
import { emptyBook, supplyReconciles as sunreySupplyReconciles } from '../economics/supply.ts';
import { handoffHash } from './hash.ts';
import {
  assertHandoffRehearsalIdentity,
  HANDOFF_REHEARSAL_ADDRESS_HRP,
  HANDOFF_REHEARSAL_CHAIN_ID,
  HANDOFF_REHEARSAL_ID,
  HANDOFF_REHEARSAL_NETWORK_ID,
  handoffDoesNotLaunchMainnet,
} from './identity.ts';
import { createHandoffReport, createReadinessReport, deriveObservedProduction } from './handoff.ts';
import { backupVerificationCatalog, recordRestoreDrill } from './control.ts';
import { defaultCapabilityInventory } from './catalog.ts';
import {
  LIFECYCLE_REHEARSAL_PHASES,
  type LifecycleRehearsalPhase,
} from './types.ts';

export type LifecycleRehearsalPhaseRecord = {
  readonly phase: LifecycleRehearsalPhase;
  readonly ok: boolean;
  readonly evidenceClass: 'REHEARSAL';
  readonly notes: string;
};

export type ProductionLifecycleRehearsal = {
  readonly rehearsalId: typeof HANDOFF_REHEARSAL_ID;
  readonly networkId: typeof HANDOFF_REHEARSAL_NETWORK_ID;
  readonly chainId: typeof HANDOFF_REHEARSAL_CHAIN_ID;
  readonly addressHrp: typeof HANDOFF_REHEARSAL_ADDRESS_HRP;
  readonly phases: readonly LifecycleRehearsalPhaseRecord[];
  readonly ceremonyGenesisHash: string;
  readonly firstBlockHash: string;
  readonly stabilizationHash: string;
  readonly economicAudit: {
    readonly sunreySupplyReconciles: boolean;
    readonly moonreySupplyReconciles: boolean;
    readonly fees: 'REHEARSAL_ONLY';
    readonly validatorEconomics: 'REHEARSAL_ONLY';
    readonly treasury: 'REHEARSAL_ONLY';
    readonly exchangeDvp: 'REHEARSAL_ONLY';
    readonly machineEscrows: 'REHEARSAL_ONLY';
  };
  readonly securityAuditState: string;
  readonly providerState: string;
  readonly humanState: 'FIXTURE_REHEARSAL_ONLY';
  readonly backup: { readonly verifiedClasses: number; readonly restoreDrillExecuted: boolean };
  readonly observedProduction: false;
  readonly usableForProduction: false;
  readonly mainnetEnabled: false;
  readonly liveFlagsRemainDisabled: true;
  readonly hash: string;
};

export function runProductionLifecycleRehearsal(root = process.cwd()): ProductionLifecycleRehearsal {
  assertHandoffRehearsalIdentity(HANDOFF_REHEARSAL_NETWORK_ID, HANDOFF_REHEARSAL_CHAIN_ID, HANDOFF_REHEARSAL_ADDRESS_HRP);
  if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED || LIVE_EXCHANGE_ENABLED) {
    throw new TypeError('lifecycle rehearsal requires simulation and disabled LIVE_* flags');
  }
  handoffDoesNotLaunchMainnet();

  const candidate = consumeCandidateV2(root);
  const rc = consumeMainnetRc(root);
  const candidateModulePresent =
    candidate.present ||
    existsSync(join(root, 'packages/sunrey-chain/src/mainnet/candidate-v2/index.ts')) ||
    existsSync(join(import.meta.dirname, '../mainnet/candidate-v2/index.ts'));
  const rcModulePresent =
    rc.present ||
    existsSync(join(root, 'packages/sunrey-chain/src/release-candidate/mainnet/index.ts')) ||
    existsSync(join(import.meta.dirname, '../release-candidate/mainnet/index.ts'));
  const ceremony = runProductionGenesisCeremonyDressRehearsal(root);
  const report = createHandoffReport(root);
  const readiness = createReadinessReport(root);
  const provider = consumeProviderAcceptance(root);
  const audit = consumeAuditEvidence(root);
  const sunrey = emptyBook('SUNREY_COIN', 'chunk-71');
  const moonrey = emptyMoonReySupply();
  const backups = backupVerificationCatalog();
  const drill = recordRestoreDrill({
    drillId: 'restore_handoff_rehearsal_1',
    class: 'CHAIN_SNAPSHOT',
    executed: true,
  });

  const firstBlockHash = handoffHash({
    genesis: ceremony.genesisHash,
    height: 1,
    networkId: HANDOFF_REHEARSAL_NETWORK_ID,
    isolated: true,
  });
  const stabilizationHash = handoffHash({
    phase: 'STABILITY_WINDOW',
    firstBlockHash,
    capabilities: defaultCapabilityInventory(),
  });

  const phases: LifecycleRehearsalPhaseRecord[] = [
    {
      phase: 'CHUNK_86_PRODUCTION_PLAN_AND_PRE_GENESIS',
      ok: candidateModulePresent && rcModulePresent,
      evidenceClass: 'REHEARSAL',
      notes: 'Binds Mainnet RC and Candidate V2 without authorizing production',
    },
    {
      phase: 'CHUNK_87_CEREMONY_AND_AUTHORIZED_GENESIS',
      ok: ceremony.transcriptVerified && ceremony.usableForProduction === false,
      evidenceClass: 'REHEARSAL',
      notes: 'Dress-rehearsal ceremony and genesis hash; unusable for production',
    },
    {
      phase: 'CHUNK_88_FIRST_BLOCK_AND_POST_GENESIS',
      ok: Boolean(firstBlockHash),
      evidenceClass: 'REHEARSAL',
      notes: 'Isolated first-block record. Not observed production.',
    },
    {
      phase: 'CHUNK_89_STABILIZATION_AND_CAPABILITY_EVIDENCE',
      ok: Boolean(stabilizationHash) && defaultCapabilityInventory().every((row) => row.state !== 'ACTIVE'),
      evidenceClass: 'REHEARSAL',
      notes: 'Stabilization and capability evidence remain inactive/restricted',
    },
    {
      phase: 'CHUNK_90_OPERATOR_HANDOFF_AND_EVIDENCE_SEAL',
      ok: report.seal.provesIntegrityOfIncludedRecords && report.observedProduction === false,
      evidenceClass: 'REHEARSAL',
      notes: `handoffState=${readiness.handoffState}; fixture acceptance only`,
    },
  ];
  if (phases.length !== LIFECYCLE_REHEARSAL_PHASES.length) {
    throw new TypeError('86-90 rehearsal chain is incomplete');
  }

  const observedProduction = deriveObservedProduction({
    evidenceClass: 'REHEARSAL',
    rehearsal: true,
    fixture: true,
    isolatedTest: true,
    humanAuthorizationPresent: false,
    actualProductionEvidencePresent: false,
  });
  if (observedProduction) {
    throw new TypeError('rehearsal cannot become observed production');
  }

  const result = {
    rehearsalId: HANDOFF_REHEARSAL_ID,
    networkId: HANDOFF_REHEARSAL_NETWORK_ID,
    chainId: HANDOFF_REHEARSAL_CHAIN_ID,
    addressHrp: HANDOFF_REHEARSAL_ADDRESS_HRP,
    phases: Object.freeze(phases),
    ceremonyGenesisHash: ceremony.genesisHash,
    firstBlockHash,
    stabilizationHash,
    economicAudit: Object.freeze({
      sunreySupplyReconciles: sunreySupplyReconciles(sunrey),
      moonreySupplyReconciles: moonreySupplyReconciles(moonrey),
      fees: 'REHEARSAL_ONLY' as const,
      validatorEconomics: 'REHEARSAL_ONLY' as const,
      treasury: 'REHEARSAL_ONLY' as const,
      exchangeDvp: 'REHEARSAL_ONLY' as const,
      machineEscrows: 'REHEARSAL_ONLY' as const,
    }),
    securityAuditState: audit.externalReviewStatus,
    providerState: provider.acceptanceStatus,
    humanState: 'FIXTURE_REHEARSAL_ONLY' as const,
    backup: Object.freeze({
      verifiedClasses: backups.length,
      restoreDrillExecuted: drill.executed,
    }),
    observedProduction: false as const,
    usableForProduction: false as const,
    mainnetEnabled: false as const,
    liveFlagsRemainDisabled: true as const,
    hash: '',
  };
  return Object.freeze({ ...result, hash: handoffHash({ ...result, hash: '' }) });
}
