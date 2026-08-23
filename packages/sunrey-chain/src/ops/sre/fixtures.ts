import { degradedPaymentPath, healthySnapshots } from '../control-room/fixtures.ts';
import { HEALTHY_SRE_SIGNALS, type SreSignals } from './platform.ts';

export function healthySreSignals(): SreSignals {
  return HEALTHY_SRE_SIGNALS;
}

export function incidentSreSignals(): SreSignals {
  return Object.freeze({
    ...HEALTHY_SRE_SIGNALS,
    apiAvailable: false,
    databaseHealthy: false,
    ledgerPostFailure: true,
    securityAnomaly: true,
    vaultAccessAnomaly: true,
  });
}

export function degradedSreSignals(): SreSignals {
  return Object.freeze({
    ...HEALTHY_SRE_SIGNALS,
    providerHealthy: false,
    reconciliationBreaks: 3n,
    queueDepth: 140n,
    agentHealthy: false,
    walletBacklog: 40n,
    treasuryLiquidityWarning: true,
  });
}

export { degradedPaymentPath, healthySnapshots };
