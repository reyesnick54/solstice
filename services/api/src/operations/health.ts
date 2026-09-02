/**
 * Wave 8 — service health and readiness evaluation.
 *
 * Distinguishes PROCESS_UP from READY_TO_SERVE.
 */

import type { PlatformApiConfig } from '../config.ts';
import type { ReadinessReport } from '../readiness.ts';
import type { OperationsCollectors } from './collectors.ts';
import { collectChainStatus } from './collectors.ts';
import {
  OPERATIONS_PLANE,
  OPERATIONS_SCHEMA_VERSION,
  type AggregateProductHealth,
  type ServiceHealthRecord,
  type ServicePhase,
} from './types.ts';

const CORE_SERVICES = [
  'platform-api',
  'consumer-bff',
  'identity',
  'ledger',
  'evidence',
  'security',
  'economic-awareness',
  'human-economy',
  'productive-economy',
  'wallet',
  'exchange-sandbox',
  'agents',
  'vault',
  'sunrey-chain',
  'monitoring',
] as const;

function phase(ready: boolean): ServicePhase {
  return ready ? 'READY_TO_SERVE' : 'PROCESS_UP';
}

export function evaluateServiceHealth(input: {
  readonly config: PlatformApiConfig;
  readonly readiness: ReadinessReport;
  readonly collectors: OperationsCollectors;
  readonly persistenceConfigured?: boolean;
  readonly chainAvailable?: boolean;
}): AggregateProductHealth {
  const chain = collectChainStatus(input.collectors.chain);
  const chainReady = chain.consensusState === 'ACTIVE';
  const persistenceReady = input.persistenceConfigured !== false;
  const platformReady = input.readiness.ready;
  const providerHealth = input.collectors.providerPlane.aggregateHealth();

  const records: ServiceHealthRecord[] = [
    service('platform-api', platformReady, platformReady ? 'readiness checks passed' : 'readiness checks incomplete', ['configuration']),
    service('consumer-bff', true, 'preview runtime available', ['platform-api', 'identity']),
    service('identity', true, 'simulation identity facade ready', ['persistence']),
    service('ledger', persistenceReady, persistenceReady ? 'ledger port reachable' : 'persistence optional in preview', ['persistence']),
    service('evidence', true, 'hash-chained vault available', ['ledger']),
    service('security', true, 'credential plane simulation ready', ['kms-simulation']),
    service(
      'economic-awareness',
      providerHealth.degraded === 0,
      providerHealth.degraded === 0 ? 'provider plane healthy' : 'provider degradation detected',
      ['providers'],
    ),
    service('human-economy', true, 'HIN and contribution surfaces ready', ['identity', 'vault']),
    service('productive-economy', true, 'productive operations platform ready', ['economic-awareness']),
    service('wallet', true, 'simulation wallet product ready', ['custody-simulation', 'chain']),
    service('exchange-sandbox', true, 'exchange sandbox only', ['ledger', 'custody-simulation']),
    service('agents', true, 'ProposalGate isolation enforced', ['identity', 'authorization']),
    service('vault', true, 'personal data vault simulation ready', ['security']),
    service('sunrey-chain', chainReady, chainReady ? 'simulation chain active' : 'chain unavailable', ['validators']),
    service('monitoring', true, 'control room and metrics plane attached', ['platform-api']),
  ];

  const readyToServe = records.every((row) => row.ready || row.service === 'ledger');
  return Object.freeze({
    schema: OPERATIONS_SCHEMA_VERSION,
    plane: OPERATIONS_PLANE,
    environment: 'simulation',
    productionActive: false,
    productionReady: false,
    liveConnectivityEnabled: false,
    aggregatePhase: readyToServe ? 'READY_TO_SERVE' : 'PROCESS_UP',
    readyToServe,
    services: Object.freeze(records),
    observedAt: chain.observedAt,
  });
}

function service(serviceName: string, ready: boolean, detail: string, dependencies: readonly string[]): ServiceHealthRecord {
  return Object.freeze({
    service: serviceName,
    phase: phase(ready),
    ready,
    detail,
    dependencies: Object.freeze([...dependencies]),
  });
}

export function listCoreServices(): readonly string[] {
  return CORE_SERVICES;
}
