/**
 * ACCESS Wave 2 — Bootstrap the Access Provider Registry with all providers.
 */

import { createAccessProviderGateway } from '../gateway.ts';
import { COMMERCIAL_PROVIDER_IDS } from '../types.ts';
import { bridgeLegacyProvider } from './bridge.ts';
import { createAllDiscoveryProviders } from './discovery-adapters.ts';
import { createAccessProviderRegistry } from './registry.ts';
import { AccessProviderRiskMonitor } from './risk.ts';
import { createAccessDiscoveryService } from './discovery-service.ts';
import { AccessProviderOperations } from './operations.ts';
import { AccessBookingReconciliationService } from './reconciliation.ts';
import { AccessCapacityApprovalService } from './capacity-approval.ts';
import type { AccessProviderRegistry } from './registry.ts';
import type { AccessDiscoveryService } from './discovery-service.ts';

export type AccessProviderSdkWorld = {
  readonly registry: AccessProviderRegistry;
  readonly risk: AccessProviderRiskMonitor;
  readonly discovery: AccessDiscoveryService;
  readonly operations: AccessProviderOperations;
  readonly reconciliation: AccessBookingReconciliationService;
  readonly capacityApproval: AccessCapacityApprovalService;
};

export function bootstrapAccessProviderSdk(): AccessProviderSdkWorld {
  const risk = new AccessProviderRiskMonitor();
  const registry = createAccessProviderRegistry({ risk });
  const gateway = createAccessProviderGateway();

  for (const providerId of COMMERCIAL_PROVIDER_IDS) {
    const legacy = gateway.getProvider(providerId);
    if (legacy) {
      registry.register(bridgeLegacyProvider(legacy), {
        commercialPriority: providerId === 'expedia' ? 80 : 50,
        trustScore: providerId === 'expedia' ? 75 : 50,
      });
    }
  }

  for (const discovery of createAllDiscoveryProviders()) {
    registry.register(discovery, { commercialPriority: 30, trustScore: 60 });
  }

  const discovery = createAccessDiscoveryService(registry, risk);
  const operations = new AccessProviderOperations(registry, risk);
  const reconciliation = new AccessBookingReconciliationService();
  const capacityApproval = new AccessCapacityApprovalService();

  return Object.freeze({
    registry,
    risk,
    discovery,
    operations,
    reconciliation,
    capacityApproval,
  });
}
