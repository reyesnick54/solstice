/**
 * Chunk 141 product-identity demo. Prints canonical names and generated counts.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runNamingAudit } from './naming-audit.ts';
import {
  currentBlockchainName,
  currentExchangeName,
  currentMasterBrand,
  currentNativeAssetDisplayNames,
  PRODUCT_IDENTITY,
} from './product-identity.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const audit = runNamingAudit(root);
const assets = currentNativeAssetDisplayNames();

console.log(`MASTER_BRAND=${currentMasterBrand()}`);
console.log(`BLOCKCHAIN=${currentBlockchainName()}`);
console.log(`SUNREY_ASSET=${assets.sunReyCoin}`);
console.log(`MOONREY_ASSET=${assets.moonReyCoin}`);
console.log(`EXCHANGE=${currentExchangeName()}`);
console.log(`TICKER_STATUS=${PRODUCT_IDENTITY.tickerStatus}`);
console.log(`LEGACY_PUBLIC_OCCURRENCES=${audit.inventory.summary.publicLegacyCount}`);
console.log(`HISTORICAL_ALLOWLIST_OCCURRENCES=${audit.inventory.summary.allowlistedCount}`);
