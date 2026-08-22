/**
 * Policy-controlled, deterministic, auditable provider routing.
 * AI cannot freely choose an arbitrary financial provider.
 */

import { canPerform } from './capabilities.ts';
import { healthBlocksRouting } from './control.ts';
import { assertCredentialEnvironment, assertEnvironmentIsolation } from './environment.ts';
import { lifecycleSufficientForSandbox } from './lifecycle.ts';
import {
  universalErr,
  universalOk,
  type KillSwitchRecord,
  type ProviderHealthRecord,
  type ProviderRegistration,
  type RoutingDecision,
  type RoutingInquiry,
  type UniversalResult,
} from './types.ts';

export function routeProviders(
  registrations: readonly ProviderRegistration[],
  health: ReadonlyMap<string, ProviderHealthRecord>,
  killSwitches: readonly KillSwitchRecord[],
  inquiry: RoutingInquiry,
): UniversalResult<RoutingDecision> {
  const eligible: ProviderRegistration[] = [];
  for (const registration of registrations) {
    if (!canPerform(registration, inquiry.capability)) {
      continue;
    }
    if (!lifecycleSufficientForSandbox(registration.lifecycleState)) {
      continue;
    }
    const isolation = assertEnvironmentIsolation(registration, inquiry.environment);
    if (!isolation.ok) {
      continue;
    }
    if (registration.credentialReference) {
      const creds = assertCredentialEnvironment(registration.credentialReference, inquiry.environment);
      if (!creds.ok) {
        continue;
      }
    }
    if (inquiry.jurisdiction && !registration.enabledJurisdictions.includes(inquiry.jurisdiction)) {
      continue;
    }
    if (inquiry.currency && !registration.supportedCurrencies.includes(inquiry.currency)) {
      continue;
    }
    if (inquiry.product && !registration.supportedProducts.includes(inquiry.product)) {
      continue;
    }
    const snapshot = health.get(registration.providerId);
    if (snapshot && healthBlocksRouting(snapshot.state)) {
      continue;
    }
    if (killSwitchBlocks(registration, inquiry, killSwitches)) {
      continue;
    }
    eligible.push(registration);
  }

  if (eligible.length === 0) {
    return universalErr('PROVIDER_ROUTE_UNAVAILABLE', 'no policy-eligible provider for this inquiry');
  }

  const ordered = [...eligible].sort((left, right) => {
    if (left.routingPriority !== right.routingPriority) {
      return left.routingPriority - right.routingPriority;
    }
    return left.providerId.localeCompare(right.providerId);
  });
  const selected = ordered[0]!;
  return universalOk(
    Object.freeze({
      selectedProviderId: selected.providerId,
      candidates: Object.freeze(ordered.map((row) => row.providerId)),
      reason: `priority=${selected.routingPriority};capability=${inquiry.capability}`,
      deterministic: true as const,
      auditable: true as const,
      aiChoseFreely: false as const,
    }),
  );
}

function killSwitchBlocks(
  registration: ProviderRegistration,
  inquiry: RoutingInquiry,
  killSwitches: readonly KillSwitchRecord[],
): boolean {
  return killSwitches.some((row) => {
    if (!row.active || row.providerId !== registration.providerId) {
      return false;
    }
    if (row.scope === 'PROVIDER') {
      return true;
    }
    if (row.scope === 'OUTBOUND_MUTATIONS') {
      return true;
    }
    if (row.scope === 'CAPABILITY' && row.target === inquiry.capability) {
      return true;
    }
    if (row.scope === 'JURISDICTION' && inquiry.jurisdiction === row.target) {
      return true;
    }
    if (row.scope === 'PRODUCT' && inquiry.product === row.target) {
      return true;
    }
    return false;
  });
}
