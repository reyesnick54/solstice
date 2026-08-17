import { runMainnetCommand } from './cli.ts';

const argv = process.argv.slice(2);
const command = argv[0] === 'sunrey-mainnet' ? argv.slice(1) : argv;
const result = runMainnetCommand(command);
process.stdout.write(`${JSON.stringify(result.payload, null, 2)}\n`);
process.exit(result.ok ? 0 : 1);
