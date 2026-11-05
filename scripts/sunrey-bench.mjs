#!/usr/bin/env node
import { runSunreyBench } from '../packages/sunrey-chain/src/perf/cli.ts';
import { measureExplorer } from '../packages/sunrey-explorer/src/perf.ts';
import { measureExchange } from '../packages/sunrey-exchange/src/perf.ts';
import { measureSdk } from '../packages/sunrey-sdk/src/perf.ts';
import { createHeliosIntegratedMemoryHarness } from '../packages/platform/src/helios/hardening/memory-soak-snapshot.ts';

const argv = process.argv.slice(2);
const isSoak = argv[0] === 'soak' || (argv.includes('soak') && argv[0] !== 'compare');
const integratedOn = process.env.SUNREY_BENCH_HELIOS_INTEGRATED === '1';

const code = runSunreyBench(argv, {
  explorer: { measure: measureExplorer },
  exchange: { measure: measureExchange },
  sdk: { measure: measureSdk },
  ...(isSoak && integratedOn ? { soakIntegrated: createHeliosIntegratedMemoryHarness() } : {}),
});
process.exit(code);
