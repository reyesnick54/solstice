/**
 * Runtime flags. LIVE_* stays false. ENVIRONMENT stays simulation.
 * Changing these values is a product decision, not a code convenience.
 * Tests lock every flag to false.
 */
export const ENVIRONMENT = 'simulation' as const;

export type LiveFlagName =
  | 'LIVE_PAYMENTS'
  | 'LIVE_FX'
  | 'LIVE_SANCTIONS'
  | 'LIVE_AML'
  | 'LIVE_RAILS'
  | 'LIVE_SWIFT'
  | 'LIVE_SEPA'
  | 'LIVE_INSTANT'
  | 'LIVE_DOMESTIC'
  | 'LIVE_NETWORK';

export const LIVE_FLAGS: Readonly<Record<LiveFlagName, false>> = Object.freeze({
  LIVE_PAYMENTS: false,
  LIVE_FX: false,
  LIVE_SANCTIONS: false,
  LIVE_AML: false,
  LIVE_RAILS: false,
  LIVE_SWIFT: false,
  LIVE_SEPA: false,
  LIVE_INSTANT: false,
  LIVE_DOMESTIC: false,
  LIVE_NETWORK: false,
});

export function assertSimulationOnly(): void {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('Solstice kernel refuses to run outside simulation in this build');
  }
  for (const [name, value] of Object.entries(LIVE_FLAGS)) {
    if (value !== false) {
      throw new Error(`${name} must stay false; live rails are not permitted`);
    }
  }
}

export function isLiveFlag(name: string): name is LiveFlagName {
  return Object.hasOwn(LIVE_FLAGS, name);
}
