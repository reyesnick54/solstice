#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runConsensusCampaign, runEconomicCampaign } from './campaigns.ts';
import { loadHexCorpus, replayProtocolCorpus } from './corpus.ts';
import { coverageCounts, COVERAGE_INVENTORY } from './coverage.ts';
import { generateDifferentialCases, assertDifferentialAgreement } from './differential.ts';
import { resolveFuzzProfile } from './profiles.ts';
import { protocolFuzzNeverPanics } from './protocol.ts';
import { assertReplay, loadReplayFixture } from './replay.ts';
import { SeededRng } from './rng.ts';
import { runSecurityRegressionFixtures } from './security.ts';

const here = dirname(fileURLToPath(import.meta.url));

function repoRoot(): string {
  return join(here, '../../../..');
}

function usage(): string {
  return [
    'sunrey-test replay <fixture>',
    'sunrey-test fuzz-smoke',
    'sunrey-test fuzz-extended',
    'sunrey-test coverage',
  ].join('\n');
}

function runProfile(name: 'FUZZ_SMOKE' | 'FUZZ_EXTENDED'): void {
  const profile = resolveFuzzProfile(name);
  const seed = Number(process.env.FUZZ_SEED ?? '56');
  protocolFuzzNeverPanics(new SeededRng(seed), profile.propertyCases);
  const economic = runEconomicCampaign(seed, profile);
  const consensus = runConsensusCampaign(seed + 1, profile);
  for (const item of generateDifferentialCases(seed, Math.min(profile.propertyCases, 64))) {
    assertDifferentialAgreement(item);
  }
  runSecurityRegressionFixtures();
  const corpusRoot = join(repoRoot(), 'tests/assurance/corpus');
  replayProtocolCorpus(loadHexCorpus(corpusRoot));
  console.log(JSON.stringify({ profile: profile.name, seed, economic, consensus, coverage: coverageCounts() }, null, 2));
}

function main(argv: readonly string[]): void {
  const command = argv[0];
  if (command === 'replay') {
    const path = argv[1];
    if (!path) {
      throw new Error(usage());
    }
    const fixture = loadReplayFixture(path);
    assertReplay(fixture);
    console.log(`replay ${fixture.id}: ok`);
    return;
  }
  if (command === 'fuzz-smoke') {
    runProfile('FUZZ_SMOKE');
    return;
  }
  if (command === 'fuzz-extended') {
    runProfile('FUZZ_EXTENDED');
    return;
  }
  if (command === 'coverage') {
    console.log(JSON.stringify({ inventory: COVERAGE_INVENTORY, counts: coverageCounts() }, null, 2));
    return;
  }
  if (command === 'replay-all') {
    const dir = join(repoRoot(), 'tests/assurance/fixtures');
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.json')) {
        assertReplay(loadReplayFixture(join(dir, file)));
      }
    }
    console.log('replay-all: ok');
    return;
  }
  throw new Error(usage());
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
