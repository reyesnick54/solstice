/**
 * Live provider credential and feature-flag resolution.
 * Missing credentials fail safely; API service must still boot.
 */

export type LiveProviderEnvConfig = {
  readonly vastApiKey: string | null;
  readonly ticketmasterApiKey: string | null;
  readonly eiaApiKey: string | null;
  readonly openChargeMapApiKey: string | null;
  readonly ebayClientId: string | null;
  readonly ebayClientSecret: string | null;
  readonly ebayMarketplaceId: string;
  readonly googlePlacesEnabled: boolean;
  readonly googlePlacesApiKey: string | null;
  readonly yelpEnabled: boolean;
  readonly yelpApiKey: string | null;
  readonly runLiveSmokeTests: boolean;
};

function env(key: string): string | null {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function envBool(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

export function resolveLiveProviderEnvConfig(): LiveProviderEnvConfig {
  return Object.freeze({
    vastApiKey: env('VAST_API_KEY'),
    ticketmasterApiKey: env('TICKETMASTER_API_KEY'),
    eiaApiKey: env('EIA_API_KEY'),
    openChargeMapApiKey: env('OPEN_CHARGE_MAP_API_KEY'),
    ebayClientId: env('EBAY_CLIENT_ID'),
    ebayClientSecret: env('EBAY_CLIENT_SECRET'),
    ebayMarketplaceId: env('EBAY_MARKETPLACE_ID') ?? 'EBAY_US',
    googlePlacesEnabled: envBool('GOOGLE_PLACES_ENABLED', false),
    googlePlacesApiKey: env('GOOGLE_PLACES_API_KEY'),
    yelpEnabled: envBool('YELP_ENABLED', false),
    yelpApiKey: env('YELP_API_KEY'),
    runLiveSmokeTests: envBool('RUN_LIVE_PROVIDER_SMOKE_TESTS', false),
  });
}

export function credentialConfigured(envKey: string): boolean {
  const value = process.env[envKey];
  return typeof value === 'string' && value.trim().length > 0;
}
