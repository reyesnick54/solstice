/**
 * ALPHA06 — MD15 current-main market-data posture gate (read-only, simulation).
 */

import { ENVIRONMENT, LIVE_TRADING_ENABLED, MARKET_DATA_LIVE_SHADOW_ENABLED } from '@solstice/config';

import { listMdWorkPackages } from '../../market-data/work-package-registry.ts';
import {
  HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED,
} from '../../market-data/taxonomy.ts';

export type Md15PostureInput = {
  readonly root: string;
  readonly mdWorkPackagesOk?: boolean;
};

export type Md15PostureResult = {
  readonly marker: typeof HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED | 'MD15_POSTURE_BLOCKED';
  readonly ok: boolean;
  readonly blockers: readonly string[];
  readonly liveShadowEnabled: boolean;
};

export function evaluateMd15MarketDataPosture(input: Md15PostureInput): Md15PostureResult {
  const blockers: string[] = [];
  const workPackages = listMdWorkPackages(input.root);
  const packagesOk =
    input.mdWorkPackagesOk ?? workPackages.every((row) => row.status === 'IMPLEMENTED');
  if (!packagesOk) {
    blockers.push('md01_md14_work_packages_incomplete');
  }
  if (ENVIRONMENT !== 'simulation') {
    blockers.push('environment_must_remain_simulation');
  }
  if (LIVE_TRADING_ENABLED !== false) {
    blockers.push('live_trading_must_remain_disabled');
  }
  if (MARKET_DATA_LIVE_SHADOW_ENABLED !== true && MARKET_DATA_LIVE_SHADOW_ENABLED !== false) {
    blockers.push('market_data_live_shadow_flag_invalid');
  }
  const ok = blockers.length === 0;
  return Object.freeze({
    marker: ok ? HELIOS_PRODUCTION_MARKET_DATA_V1_QUALIFIED : 'MD15_POSTURE_BLOCKED',
    ok,
    blockers: Object.freeze(blockers),
    liveShadowEnabled: MARKET_DATA_LIVE_SHADOW_ENABLED === true,
  });
}
