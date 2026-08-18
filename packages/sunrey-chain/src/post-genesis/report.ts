import { defaultAdmissionCriteria } from './phases.ts';
import { publicNetworkStatus } from './explorer.ts';
import { POST_GENESIS_TOOL_VERSION, type ProductionStabilizationReport } from './types.ts';
import type { StabilizationState } from './plane.ts';

export function buildStabilizationReport(state: StabilizationState): ProductionStabilizationReport {
  const publicStatus = publicNetworkStatus({
    phase: state.phase,
    health: state.latestHealth,
    enabled: state.enabled,
    restricted: state.restricted,
  });
  return Object.freeze({
    schemaVersion: 1,
    toolVersion: POST_GENESIS_TOOL_VERSION,
    networkId: state.policy.networkId,
    chainId: state.policy.chainId,
    phase: state.phase,
    policy: state.policy,
    latestCheckpoint: state.latestCheckpoint,
    latestHealth: state.latestHealth,
    economicAudit: state.economicAudit,
    validatorAudit: state.validatorAudit,
    incidents: state.incidents,
    capabilities: publicStatus.capabilities,
    history: state.history,
    backups: state.backups,
    admission: defaultAdmissionCriteria(state.phase),
    realProductionCapabilitiesActivated: false,
    genesisDoesNotEnableCapabilities: true,
  });
}
