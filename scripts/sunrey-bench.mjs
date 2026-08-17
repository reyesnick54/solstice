#!/usr/bin/env node
import { runSunreyBench } from '../packages/sunrey-chain/src/perf/cli.ts';
import { measureExplorer } from '../packages/sunrey-explorer/src/perf.ts';
import { measureExchange } from '../packages/sunrey-exchange/src/perf.ts';
import { measureSdk } from '../packages/sunrey-sdk/src/perf.ts';

const code = runSunreyBench(process.argv.slice(2), {
  explorer: { measure: measureExplorer },
  exchange: { measure: measureExchange },
  sdk: { measure: measureSdk },
});
process.exit(code);
