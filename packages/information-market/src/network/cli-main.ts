#!/usr/bin/env node
import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { HumanInformationNetworkEngine } from './engine.ts';
import { formatInformationCli, runInformationCommand } from './cli.ts';

const clock = new FrozenClock(asUtcInstant('2026-08-18T00:00:00.000Z'));
const engine = new HumanInformationNetworkEngine({ clock });
const result = runInformationCommand(engine, process.argv.slice(2));
process.stdout.write(`${formatInformationCli(result)}\n`);
process.exitCode = result.ok ? 0 : 1;
