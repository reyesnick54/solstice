import { runProductionSafetySmokeCampaign } from './campaign.ts';
import { SCENARIO_CATALOG } from './catalog.ts';
import { createRangeEnvironment } from './environment.ts';
import { proveIsolation, productionSafetySummary } from './production-safety.ts';
import { PRODUCTION_SAFETY_FIXTURE_VERSION } from './types.ts';

const isolation = proveIsolation();
const env = createRangeEnvironment(157);
const families = new Set(
  SCENARIO_CATALOG.filter((row) => row.fixtureVersion === PRODUCTION_SAFETY_FIXTURE_VERSION).map(
    (row) => row.scenarioId.split('-')[0],
  ),
);
const report = runProductionSafetySmokeCampaign();
const summary = productionSafetySummary(report.results);
if (report.failed > 0 || summary.INVARIANT_BREACHES !== 0 || isolation.productionActive) {
  throw new Error(`production adversarial demo failed failed=${report.failed} breaches=${summary.INVARIANT_BREACHES}`);
}
if (families.size < 16) {
  throw new Error(`expected every new family in the catalog, got ${[...families].join(',')}`);
}

console.log('sunrey-production-adversarial-campaign');
console.log(`  environment ${env.networkId} / ${env.chainId} credentials=${env.credentials}`);
console.log(`  fixture ${PRODUCTION_SAFETY_FIXTURE_VERSION} families=${[...families].join(',')}`);
console.log(`SCENARIOS_RUN=${summary.SCENARIOS_RUN}`);
console.log(`INVARIANT_BREACHES=${summary.INVARIANT_BREACHES}`);
console.log(`LEDGER_BYPASS_SUCCEEDED=${String(summary.LEDGER_BYPASS_SUCCEEDED)}`);
console.log(`KERNEL_BYPASS_SUCCEEDED=${String(summary.KERNEL_BYPASS_SUCCEEDED)}`);
console.log(`AI_AUTHORITY_ESCALATION_SUCCEEDED=${String(summary.AI_AUTHORITY_ESCALATION_SUCCEEDED)}`);
console.log(`RAW_SECRET_EXPOSED=${String(summary.RAW_SECRET_EXPOSED)}`);
console.log(`CROSS_ASSET_CONTAMINATION=${String(summary.CROSS_ASSET_CONTAMINATION)}`);
console.log(`BLIND_RETRY_AFTER_UNKNOWN=${String(summary.BLIND_RETRY_AFTER_UNKNOWN)}`);
console.log(`REFERENCE_PRICE_MINT_SUCCEEDED=${String(summary.REFERENCE_PRICE_MINT_SUCCEEDED)}`);
console.log(`DIRECT_ASSETSUPPLYBOOK_MUTATION_SUCCEEDED=${String(summary.DIRECT_ASSETSUPPLYBOOK_MUTATION_SUCCEEDED)}`);
console.log(`REAL_EXTERNAL_TARGET_CONTACTED=${String(summary.REAL_EXTERNAL_TARGET_CONTACTED)}`);
console.log(`PRODUCTION_ACTIVE=${String(summary.PRODUCTION_ACTIVE)}`);
console.log('demo ok — isolated production-safety campaign; no external targets');
