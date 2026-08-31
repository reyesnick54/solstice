#!/usr/bin/env node
/**
 * Rebuild config/providers/free-api-catalog.yaml from authoritative partial sources.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_PATH = join(ROOT, 'config/providers/free-api-catalog.yaml');
const WAVE2_PATH = join(ROOT, 'config/providers/wave2-catalog-entries.yaml');
const WAVE3_PATH = join(ROOT, 'config/providers/wave3-crypto-catalog-entries.yaml');
const WAVE4_PATH = join(ROOT, 'config/providers/wave4-catalog-entries.yaml');
const WAVE5_PATH = join(ROOT, 'config/providers/wave5-energy-resource-catalog-entries.yaml');
const WAVE5_ENERGY_PATH = join(ROOT, 'config/providers/wave5-energy-resource-catalog-entries.yaml');
const WAVE5_TRAVEL_PATH = join(ROOT, 'config/providers/wave5-travel-catalog-entries.yaml');
const WAVE6_OPPORTUNITY_PATH = join(ROOT, 'config/providers/wave6-opportunity-skills-catalog-entries.yaml');
const WAVE6_HEALTH_PATH = join(ROOT, 'config/providers/wave6-health-hin-catalog-entries.yaml');

const wave2 = parseYaml(readFileSync(WAVE2_PATH, 'utf8'));
const wave3 = parseYaml(readFileSync(WAVE3_PATH, 'utf8'));
const wave4 = parseYaml(readFileSync(WAVE4_PATH, 'utf8'));
const wave5 = parseYaml(readFileSync(WAVE5_PATH, 'utf8'));
const wave5Energy = parseYaml(readFileSync(WAVE5_ENERGY_PATH, 'utf8'));
const wave5Travel = parseYaml(readFileSync(WAVE5_TRAVEL_PATH, 'utf8'));
const wave6Opportunity = parseYaml(readFileSync(WAVE6_OPPORTUNITY_PATH, 'utf8'));
const wave6Health = parseYaml(readFileSync(WAVE6_HEALTH_PATH, 'utf8'));

async function loadTsExport(modulePath, exportName) {
  const url = new URL(modulePath, `file://${ROOT}/`).href + `?t=${Date.now()}`;
  const mod = await import(url);
  return mod[exportName];
}

const { FX_REFERENCE_CATALOG_ENTRIES, FX_REFERENCE_BLOCKED_CATALOG_ENTRY } = {
  FX_REFERENCE_CATALOG_ENTRIES: await loadTsExport(
    './packages/payments/src/fx-reference/catalog-entries.ts',
    'FX_REFERENCE_CATALOG_ENTRIES',
  ),
  FX_REFERENCE_BLOCKED_CATALOG_ENTRY: await loadTsExport(
    './packages/payments/src/fx-reference/catalog-entries.ts',
    'FX_REFERENCE_BLOCKED_CATALOG_ENTRY',
  ),
};

const COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES = await loadTsExport(
  './packages/kernel/src/compliance-intelligence/catalog-entries.ts',
  'COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES',
);
const WAVE4_CATALOG_ENTRIES = await loadTsExport(
  './packages/external-data/src/wave4/catalog-entries.ts',
  'WAVE4_CATALOG_ENTRIES',
);
const ENVIRONMENTAL_CATALOG_ENTRIES = await loadTsExport(
  './packages/sunrey-chain/src/environmental/catalog-entries.ts',
  'ENVIRONMENTAL_CATALOG_ENTRIES',
);
const CHAIN_INTELLIGENCE_CATALOG_ENTRIES = await loadTsExport(
  './packages/sunrey-chain/src/chain-intelligence/catalog-entries.ts',
  'CHAIN_INTELLIGENCE_CATALOG_ENTRIES',
);
const CRYPTO_MARKET_CATALOG_ENTRIES = await loadTsExport(
  './packages/sunrey-exchange/src/crypto-market/catalog-entries.ts',
  'CRYPTO_MARKET_CATALOG_ENTRIES',
);
const WAVE5_PRODUCTIVE_CATALOG_ENTRIES = await loadTsExport(
  './packages/sunrey-chain/src/productive-economy-providers/catalog-entries.ts',
  'WAVE5_CATALOG_ENTRIES',
);

const byId = new Map();

function addEntries(entries) {
  for (const entry of entries ?? []) {
    if (entry?.provider_id) {
      byId.set(entry.provider_id, structuredClone(entry));
    }
  }
}

addEntries(wave2.providers);
addEntries(FX_REFERENCE_CATALOG_ENTRIES);
addEntries([FX_REFERENCE_BLOCKED_CATALOG_ENTRY]);
addEntries(wave3.providers);
addEntries(CRYPTO_MARKET_CATALOG_ENTRIES);
addEntries(CHAIN_INTELLIGENCE_CATALOG_ENTRIES);
addEntries(wave4.providers);
addEntries(WAVE4_CATALOG_ENTRIES);
addEntries(wave5.providers);
addEntries(wave5Energy.providers);
addEntries(wave5Travel.providers);
addEntries(wave6Opportunity.providers);
addEntries(wave6Health.providers);
addEntries(COMPLIANCE_INTELLIGENCE_CATALOG_ENTRIES);
addEntries(WAVE5_PRODUCTIVE_CATALOG_ENTRIES);
addEntries(ENVIRONMENTAL_CATALOG_ENTRIES);

const providerCount = byId.size;
const catalog = {
  schema_version: '1.0.0',
  catalog_id: 'sunrey-free-api-catalog',
  expected_provider_count: 126,
  population_status: providerCount >= 126 ? 'populated' : 'partial',
  source_list: {
    document:
      'wave2 + wave3 + wave4 + wave5 YAML + FX + crypto + chain-intelligence + compliance + environmental + productive-economy + opportunity + health catalog entries',
    version: 'wave-4-prompt-10',
    verified_at: '2026-08-31',
  },
  notes:
    `Wave 7 catalog rebuild: ${providerCount} unique providers merged from Waves 2–6 implementations. ` +
    'Authoritative 126-provider master list remains partially populated; remaining slots are documented in wave7 coverage as MISSING_IMPLEMENTATION.',
  providers: [...byId.values()],
};

writeFileSync(CATALOG_PATH, stringifyYaml(catalog, { lineWidth: 120 }), 'utf8');
console.log(`Wrote ${catalog.providers.length} providers to ${CATALOG_PATH}`);
