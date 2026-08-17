#!/usr/bin/env node
import { runEconomicsCommand } from './cli.ts';

const args = process.argv.slice(2);
const output = runEconomicsCommand(args.length === 0 ? ['dual'] : args);
process.stdout.write(`${output}\n`);
