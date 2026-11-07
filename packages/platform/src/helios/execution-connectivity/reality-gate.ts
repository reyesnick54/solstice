import {
  ENVIRONMENT,
  LIVE_CUSTODY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '@solstice/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ExecutionConnectivityRealityPosture = {
  readonly environment: typeof ENVIRONMENT;
  readonly liveTradingEnabled: false;
  readonly liveInvestmentExecution: false;
  readonly liveCustodyEnabled: false;
  readonly productionAuthorized: false;
  readonly engineeringArchitectureQualified: boolean;
};

function readProductionAuthorized(root: string): boolean | null {
  const mapPath = join(root, 'docs/productization/sunrey-authority-map.json');
  if (!existsSync(mapPath)) {
    return null;
  }
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as {
    productionPosture?: { production_authorized?: boolean };
  };
  return map.productionPosture?.production_authorized ?? null;
}

export function describeExecutionConnectivityRealityPosture(root: string): ExecutionConnectivityRealityPosture {
  readProductionAuthorized(root);
  return Object.freeze({
    environment: ENVIRONMENT,
    liveTradingEnabled: false,
    liveInvestmentExecution: false,
    liveCustodyEnabled: false,
    productionAuthorized: false,
    engineeringArchitectureQualified: true,
  });
}

export function assertExecutionConnectivityRealitySafe(root: string): void {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('ENVIRONMENT must remain simulation for execution-connectivity qualification');
  }
  if (LIVE_TRADING_ENABLED !== false) {
    throw new Error('LIVE_TRADING_ENABLED must remain false');
  }
  if (LIVE_INVESTMENT_EXECUTION !== false) {
    throw new Error('LIVE_INVESTMENT_EXECUTION must remain false');
  }
  if (LIVE_CUSTODY_ENABLED !== false) {
    throw new Error('LIVE_CUSTODY_ENABLED must remain false');
  }
  const productionAuthorized = readProductionAuthorized(root);
  if (productionAuthorized !== false) {
    throw new Error('production_authorized must remain false in sunrey-authority-map.json');
  }
}
