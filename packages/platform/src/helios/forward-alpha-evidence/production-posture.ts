import {
  ENVIRONMENT,
  LIVE_CUSTODY_ENABLED,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '@solstice/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function assertForwardAlphaProductionPosture(root: string): void {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('ENVIRONMENT must remain simulation for forward-alpha qualification');
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
  const mapPath = join(root, 'docs/productization/sunrey-authority-map.json');
  if (!existsSync(mapPath)) {
    throw new Error('sunrey-authority-map.json missing');
  }
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as {
    productionPosture?: { production_authorized?: boolean };
  };
  if (map.productionPosture?.production_authorized !== false) {
    throw new Error('production_authorized must remain false');
  }
}
