import { runTestnetCommand } from './cli.ts';

const argv = process.argv.slice(2);
const command = argv[0] === 'sunrey-testnet' || argv[0] === 'sunrey-genesis' ? argv.slice(1) : argv;
const result = runTestnetCommand(command.length === 0 ? ['genesis'] : command);
process.stdout.write(`${JSON.stringify(result.payload, null, 2)}\n`);
process.exit(result.ok ? 0 : 1);
