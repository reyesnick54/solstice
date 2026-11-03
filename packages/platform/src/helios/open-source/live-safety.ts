/**
 * Live / production posture checks for open-source integration qualification.
 * Does not mutate ENVIRONMENT or LIVE_* flags.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type LiveSafetyAssertion = {
  readonly name: string;
  readonly expected: boolean | string;
  readonly actual: boolean | string;
  readonly pass: boolean;
};

function readConstFlag(source: string, name: string): string | null {
  const re = new RegExp(`export const ${name} = ([^;]+);`);
  const match = source.match(re);
  return match?.[1]?.trim() ?? null;
}

export function evaluateLiveSafetyAssertions(root: string): {
  readonly assertions: readonly LiveSafetyAssertion[];
  readonly pass: boolean;
} {
  const mapPath = join(root, 'docs/productization/sunrey-authority-map.json');
  const freezePath = join(root, 'docs/productization/sunrey-architecture-freeze.json');
  const flagsPath = join(root, 'packages/config/src/flags.ts');

  let mapPosture: Record<string, unknown> = {};
  let freezePosture: Record<string, unknown> = {};
  if (existsSync(mapPath)) {
    mapPosture =
      (JSON.parse(readFileSync(mapPath, 'utf8')) as { productionPosture?: Record<string, unknown> })
        .productionPosture ?? {};
  }
  if (existsSync(freezePath)) {
    freezePosture =
      (JSON.parse(readFileSync(freezePath, 'utf8')) as { productionPosture?: Record<string, unknown> })
        .productionPosture ?? {};
  }

  const flagsSource = existsSync(flagsPath) ? readFileSync(flagsPath, 'utf8') : '';
  const environment = readConstFlag(flagsSource, 'ENVIRONMENT');
  const liveConnectivity = readConstFlag(flagsSource, 'LIVE_CONNECTIVITY_ENABLED');
  const liveTrading = readConstFlag(flagsSource, 'LIVE_TRADING_ENABLED');

  const assertions: LiveSafetyAssertion[] = [
    {
      name: 'ENVIRONMENT',
      expected: 'simulation',
      actual: environment ?? 'unset',
      pass: environment === "'simulation' as const" || environment === "'simulation'",
    },
    {
      name: 'LIVE_CONNECTIVITY_ENABLED',
      expected: false,
      actual: liveConnectivity ?? 'unset',
      pass: liveConnectivity === 'false as const' || liveConnectivity === 'false',
    },
    {
      name: 'LIVE_TRADING_ENABLED',
      expected: false,
      actual: liveTrading ?? 'unset',
      pass: liveTrading === 'false as const' || liveTrading === 'false',
    },
    {
      name: 'PRODUCTION_ACTIVE (productization freeze)',
      expected: false,
      actual: freezePosture.PRODUCTION_ACTIVE ?? 'unset',
      pass: freezePosture.PRODUCTION_ACTIVE === false,
    },
    {
      name: 'production_authorized (authority map)',
      expected: false,
      actual: mapPosture.production_authorized ?? 'unset',
      pass: mapPosture.production_authorized === false,
    },
    {
      name: 'authority_map.PRODUCTION_ACTIVE',
      expected: false,
      actual: mapPosture.PRODUCTION_ACTIVE ?? 'unset',
      pass: mapPosture.PRODUCTION_ACTIVE === false,
    },
    {
      name: 'freeze.PRODUCTION_ACTIVE',
      expected: false,
      actual: freezePosture.PRODUCTION_ACTIVE ?? 'unset',
      pass: freezePosture.PRODUCTION_ACTIVE === false,
    },
  ];

  return Object.freeze({
    assertions: Object.freeze(assertions),
    pass: assertions.every((row) => row.pass),
  });
}
