#!/usr/bin/env node
/**
 * Opt-in live provider smoke test for Access Live Provider Fabric.
 * RUN_LIVE_PROVIDER_SMOKE_TESTS=true
 */

import { createAccessLiveProviderFabricService } from '../packages/external-data/src/access-live/fabric-service.ts';
import { resolveLiveProviderEnvConfig } from '../packages/external-data/src/access-live/config.ts';
import type { LiveAccessProviderId, LiveIntegrationState } from '../packages/external-data/src/access-live/types.ts';

const PRIMARY_PROVIDERS: readonly LiveAccessProviderId[] = [
  'vast-ai',
  'ticketmaster',
  'eia',
  'open-charge-map',
  'ebay',
  'google-places',
  'yelp',
];

const PARTNER_GATED = [
  ['Expedia', 'SANDBOX_AVAILABLE'],
  ['Turo', 'PARTNER_APPROVAL_REQUIRED'],
  ['DoorDash', 'PARTNER_APPROVAL_REQUIRED'],
  ['Amazon', 'PARTNER_APPROVAL_REQUIRED'],
  ['Airbnb', 'PARTNER_APPROVAL_REQUIRED'],
] as const;

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function statusLabel(state: LiveIntegrationState): string {
  return state;
}

async function main(): Promise<number> {
  const config = resolveLiveProviderEnvConfig();
  if (!config.runLiveSmokeTests) {
    console.log('Set RUN_LIVE_PROVIDER_SMOKE_TESTS=true to run live provider smoke checks.');
    return 0;
  }

  console.log('SunRey Access Provider Fabric\n');
  const fabric = createAccessLiveProviderFabricService();
  let liveCount = 0;
  let configuredCount = 0;
  let runtimeErrors = 0;

  for (const providerId of PRIMARY_PROVIDERS) {
    const registration = fabric.listProviders().find((row) => row.providerId === providerId);
    const displayName = registration?.displayName ?? providerId;
    let state: LiveIntegrationState = registration?.integrationState ?? 'NOT_CONFIGURED';
    let detail = '';

    if (registration?.credentialConfigured || registration?.integrationState === 'FREE_PUBLIC') {
      configuredCount += 1;
      try {
        const result = await fabric.search({
          requestId: `smoke_${providerId}`,
          providerId,
          limit: 5,
          ...(providerId === 'open-charge-map' ? { latitude: 37.7749, longitude: -122.4194 } : {}),
          ...(providerId === 'ticketmaster' ? { city: 'New York', query: 'concert' } : {}),
          ...(providerId === 'ebay' ? { query: 'laptop' } : {}),
        });
        if (result.offers.length > 0) {
          state = 'LIVE_READ';
          liveCount += 1;
          detail = `${result.offers.length} offers`;
        } else if (result.providerErrors.length > 0) {
          state = 'ERROR';
          detail = result.providerErrors[0]?.message ?? 'error';
          runtimeErrors += 1;
        } else {
          detail = 'healthy';
        }
      } catch (error) {
        state = 'ERROR';
        detail = error instanceof Error ? error.message : 'runtime error';
        runtimeErrors += 1;
      }
    } else {
      detail = 'NOT_CONFIGURED';
    }

    console.log(`${pad(displayName, 20)} ${pad(statusLabel(state), 28)} ${detail}`);
  }

  for (const [name, state] of PARTNER_GATED) {
    console.log(`${pad(name, 20)} ${pad(state, 28)}`);
  }

  const overall =
    runtimeErrors > 0 ? 'DEGRADED' : liveCount > 0 ? (liveCount < configuredCount ? 'HEALTHY_PARTIAL' : 'HEALTHY') : 'NO_LIVE_READS';
  console.log(`\nOverall:\n${overall}`);
  return runtimeErrors > 0 ? 1 : 0;
}

main()
  .then((code) => {
    if (code !== 0) process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
