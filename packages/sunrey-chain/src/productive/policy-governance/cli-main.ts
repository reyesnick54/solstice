#!/usr/bin/env node
import { runMoonReyEconomicsCommand } from './cli.ts';

const args = process.argv.slice(2);
const result = runMoonReyEconomicsCommand(args);
process.stdout.write(`${JSON.stringify(result, bigintReplacer, 2)}\n`);
process.exit(result.ok ? 0 : 1);

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
