/**
 * Chunk 76 economic stress laboratory demo.
 *
 * Simulation only. Not production authorization.
 */

import { requiredCatalogComplete } from './catalog.ts';
import { runSmokeStressCampaign } from './campaign.ts';
import { runPropertyStream } from './property.ts';
import { renderStressReport } from './report.ts';

export function runEconomicStressDemo(): string {
  if (!requiredCatalogComplete()) {
    throw new Error('economic stress catalog must contain at least 60 unique scenarios');
  }
  const smoke = runSmokeStressCampaign();
  const properties = runPropertyStream(76, 8);
  return [
    'SunRey economic stress laboratory (Chunk 76)',
    `catalog complete=${requiredCatalogComplete()}`,
    renderStressReport(smoke),
    `property stream held=${properties.held} steps=${properties.steps}`,
    'productionAuthorization=false',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${runEconomicStressDemo()}\n`);
}
