import type { ValidatorSet } from '../validators/index.ts';
import { validateValidatorConfig } from './config.ts';
import { availableSentryCount } from './sentry.ts';
import type { SentryTopology } from './types.ts';
import type { SignerSafetyStore } from './signer-safety.ts';
import type { OperatorReadinessReport, ReadinessCheck, ValidatorNodeConfig } from './types.ts';

export function operatorReadiness(input: {
  readonly config: ValidatorNodeConfig;
  readonly genesisHash: string;
  readonly validatorSet: ValidatorSet;
  readonly validatorId: string;
  readonly signerAvailable: boolean;
  readonly safety: SignerSafetyStore;
  readonly topology: SentryTopology;
  readonly unavailableSentries: ReadonlySet<string>;
  readonly stateSyncComplete: boolean;
  readonly localFinalizedHeight: bigint;
  readonly networkFinalizedHeight: bigint;
  readonly diskOk: boolean;
  readonly protocolCompatible: boolean;
  readonly pendingUpgrade: string | null;
  readonly nowUtc: string;
}): OperatorReadinessReport {
  const config = validateValidatorConfig(input.config);
  const member = input.validatorSet.validators.some(
    (row) => row.validatorId === input.validatorId && row.status === 'ACTIVE',
  );
  const watermark = input.safety.safety.load();
  const peers = availableSentryCount(input.topology, input.unavailableSentries);
  const lag = input.networkFinalizedHeight - input.localFinalizedHeight;
  const checks: ReadinessCheck[] = [
    { id: 'network-identity', ok: input.config.networkId.length > 0 && input.config.chainId.length > 0, detail: `${input.config.networkId}/${input.config.chainId}` },
    { id: 'genesis', ok: input.genesisHash.length === 64, detail: input.genesisHash },
    { id: 'validator-membership', ok: member, detail: member ? input.validatorId : 'not in active set' },
    { id: 'signer-availability', ok: input.signerAvailable, detail: input.signerAvailable ? 'signer reachable' : 'signer unavailable' },
    {
      id: 'signer-safety-high-watermark',
      ok: watermark !== null,
      detail: watermark
        ? `${watermark.lastSignedHeight.toString()}/${watermark.lastSignedRound.toString()}/${watermark.lastSignedStep}`
        : 'empty',
    },
    { id: 'peer-count', ok: peers >= 1, detail: `${peers} sentry path(s)` },
    { id: 'state-sync', ok: input.stateSyncComplete, detail: input.stateSyncComplete ? 'synced' : 'syncing' },
    { id: 'finalized-height-lag', ok: lag <= 2n, detail: `lag ${lag.toString()}` },
    { id: 'disk', ok: input.diskOk, detail: input.diskOk ? 'ok' : 'pressure' },
    { id: 'protocol-compatibility', ok: input.protocolCompatible, detail: input.config.protocolVersion },
    { id: 'pending-upgrades', ok: true, detail: input.pendingUpgrade ?? 'none' },
    { id: 'config', ok: config.ok, detail: config.ok ? 'safe' : config.error.message },
  ];
  return {
    ready: checks.every((check) => check.ok),
    role: input.config.role,
    networkId: input.config.networkId,
    chainId: input.config.chainId,
    checks,
    atUtc: input.nowUtc,
  };
}
