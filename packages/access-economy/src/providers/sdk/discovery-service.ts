/**
 * ACCESS Wave 2 — AccessDiscoveryService.
 *
 * Unified discovery composing provider registry search with capability-aware
 * selection and safe fallback.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { AccessProviderId, ProviderCapabilityId } from '../types.ts';
import type { AccessOpportunity } from './domain-types.ts';
import { decideDiscoveryFallback } from './fallback.ts';
import type { AccessInventoryProvider } from './interfaces.ts';
import type { AccessProviderRegistry } from './registry.ts';
import { selectProvider, type ProviderSelectionCandidate } from './selection.ts';
import type { AccessProviderRiskMonitor } from './risk.ts';

export type AccessDiscoverySearchInput = {
  readonly requestId: string;
  readonly category: AccessCapacityCategory;
  readonly query: string;
  readonly geography: string | null;
  readonly limit: number;
  readonly capability?: ProviderCapabilityId;
};

export type AccessDiscoverySearchResult = {
  readonly requestId: string;
  readonly opportunities: readonly AccessOpportunity[];
  readonly providerId: AccessProviderId;
  readonly selectionReason: string;
  readonly simulationOnly: boolean;
  readonly fallbackUsed: boolean;
};

export class AccessDiscoveryService {
  private readonly registry: AccessProviderRegistry;
  private readonly risk: AccessProviderRiskMonitor;

  constructor(registry: AccessProviderRegistry, risk: AccessProviderRiskMonitor) {
    this.registry = registry;
    this.risk = risk;
  }

  async search(input: AccessDiscoverySearchInput): Promise<
    | { readonly ok: true; readonly value: AccessDiscoverySearchResult }
    | { readonly ok: false; readonly code: string; readonly message: string }
  > {
    const capability = input.capability ?? 'CATALOG_SEARCH';
    const candidates = this.registry.findProviders({
      category: input.category,
      capability,
      geography: input.geography,
    });

    if (candidates.length === 0) {
      return Object.freeze({ ok: false, code: 'NO_PROVIDERS', message: 'no discovery providers match criteria' });
    }

    const selectionCandidates: ProviderSelectionCandidate[] = await Promise.all(
      candidates.map(async (row) =>
        Object.freeze({
          descriptor: row.descriptor,
          health: (await this.registry.getHealth(row.descriptor.providerId))!,
          risk: this.risk.assess({ providerId: row.descriptor.providerId }),
          commercialPriority: row.commercialPriority,
          trustScore: row.trustScore,
        }),
      ),
    );

    const selection = selectProvider(selectionCandidates, {
      category: input.category,
      capability,
      geography: input.geography,
    });

    if (!selection.selectedProviderId) {
      return Object.freeze({ ok: false, code: 'SELECTION_FAILED', message: selection.reason });
    }

    let attemptIndex = 0;
    let currentProviderId = selection.selectedProviderId;
    let fallbackUsed = false;

    while (attemptIndex < selection.ranked.length) {
      const registration = this.registry.get(currentProviderId);
      if (!registration) {
        break;
      }
      const provider = registration.provider;
      if (!this.isInventoryProvider(provider)) {
        return Object.freeze({ ok: false, code: 'NOT_INVENTORY_PROVIDER', message: `${currentProviderId} is not an inventory provider` });
      }

      const outcome = provider.search({
        requestId: input.requestId,
        category: input.category,
        query: input.query,
        geography: input.geography,
        limit: input.limit,
      });

      if (outcome.ok) {
        return Object.freeze({
          ok: true,
          value: Object.freeze({
            requestId: input.requestId,
            opportunities: outcome.value.opportunities,
            providerId: currentProviderId,
            selectionReason: fallbackUsed
              ? `${selection.reason}; ${decideDiscoveryFallback(selection, currentProviderId, attemptIndex - 1).reason}`
              : selection.reason,
            simulationOnly: outcome.value.simulationOnly,
            fallbackUsed,
          }),
        });
      }

      const fallback = decideDiscoveryFallback(selection, currentProviderId, attemptIndex);
      if (!fallback.allowed || !fallback.nextProviderId) {
        return Object.freeze({ ok: false, code: outcome.code, message: outcome.message });
      }
      currentProviderId = fallback.nextProviderId;
      attemptIndex += 1;
      fallbackUsed = true;
    }

    return Object.freeze({ ok: false, code: 'EXHAUSTED', message: 'all discovery providers failed' });
  }

  private isInventoryProvider(provider: import('./contract.ts').AccessProvider): provider is AccessInventoryProvider {
    return 'search' in provider && typeof (provider as AccessInventoryProvider).search === 'function';
  }
}

export function createAccessDiscoveryService(
  registry: AccessProviderRegistry,
  risk: AccessProviderRiskMonitor,
): AccessDiscoveryService {
  return new AccessDiscoveryService(registry, risk);
}
