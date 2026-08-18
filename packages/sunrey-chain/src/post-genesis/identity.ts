import {
  POST_GENESIS_SCHEMA_VERSION,
  POST_GENESIS_TOOL_VERSION,
  type PostGenesisNetworkClass,
  type PostGenesisPhase,
  type PostGenesisPolicy,
} from './types.ts';

export const REHEARSAL_NETWORK_ID = 'net_sunrey_post_genesis_rehearsal_1' as const;
export const REHEARSAL_CHAIN_ID = 'chn_sunrey_post_genesis_rehearsal_1' as const;
export const REHEARSAL_RELEASE_ID = 'SUNREY_POST_GENESIS_REHEARSAL_1' as const;
export const REHEARSAL_PROTOCOL = 'sunrey-protocol-0' as const;
export const REHEARSAL_POLICY_VERSION = 'post-genesis-policy/1' as const;
export const REHEARSAL_NETWORK_CLASS: PostGenesisNetworkClass = 'REHEARSAL';

export function defaultPostGenesisPolicy(): PostGenesisPolicy {
  return Object.freeze({
    policyId: 'pgp_rehearsal_1',
    policyVersion: REHEARSAL_POLICY_VERSION,
    networkId: REHEARSAL_NETWORK_ID,
    chainId: REHEARSAL_CHAIN_ID,
    releaseId: REHEARSAL_RELEASE_ID,
    activeProtocol: REHEARSAL_PROTOCOL,
    initialPhase: 'CHAIN_STABILIZATION',
    checkpointHeights: Object.freeze([1, 8, 16, 32]),
    checkpointEpochs: Object.freeze([0, 1, 2]),
    rpcMayOperate: true,
    explorerMayOperate: true,
    monitoringOperates: true,
    backupsOperate: true,
    highRiskFinancialDefault: 'INDEPENDENTLY_DISABLED',
    moonreyProductiveIssuanceDefault: 'EXPLICITLY_DISABLED',
    treasurySpendingAuthorizedByGenesis: false,
    privacyDefault: 'DENY',
    rawPdvUnavailable: true,
    interopTrustedBridgeRoot: false,
    realProductionCapabilitiesActivated: false,
  });
}

export function initialPhase(): PostGenesisPhase {
  return 'CHAIN_STABILIZATION';
}

export function toolIdentity(): {
  readonly schemaVersion: typeof POST_GENESIS_SCHEMA_VERSION;
  readonly toolVersion: typeof POST_GENESIS_TOOL_VERSION;
  readonly realProductionCapabilitiesActivated: false;
} {
  return Object.freeze({
    schemaVersion: POST_GENESIS_SCHEMA_VERSION,
    toolVersion: POST_GENESIS_TOOL_VERSION,
    realProductionCapabilitiesActivated: false,
  });
}
