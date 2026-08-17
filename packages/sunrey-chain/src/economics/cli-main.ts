import { runEconomicsCommand } from './cli.ts';

const result = runEconomicsCommand(process.argv.slice(2));
console.log(JSON.stringify(result.payload, null, 2));
process.exitCode = result.ok ? 0 : 1;
