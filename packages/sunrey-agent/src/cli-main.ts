#!/usr/bin/env node
import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { runSunReyAgent } from './cli.ts';
import { UserAgentMandateEngine } from './engine.ts';

const engine = new UserAgentMandateEngine({
  clock: new FrozenClock(asUtcInstant('2026-08-18T00:00:00.000Z')),
  kernel: {
    submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_cli_sim' }),
  },
});
const result = runSunReyAgent(engine, process.argv.slice(2));
console.log(JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
if (!result.ok) {
  process.exitCode = 1;
}
