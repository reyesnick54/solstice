/**
 * sunrey-ops dispatcher.
 *
 * Validator operator-platform commands load the isolated Chunk 92
 * entry. Other commands keep the existing ops CLI.
 */

import { VALIDATOR_OPERATOR_COMMANDS } from '../validator-operator/cli.ts';

const argv = process.argv.slice(2);
const [group, action] = argv;

if (group === 'validator' && action && (VALIDATOR_OPERATOR_COMMANDS as readonly string[]).includes(action)) {
  const { main } = await import('../validator-operator/cli-main.ts');
  await main(argv);
} else {
  const { main } = await import('./cli.ts');
  await main();
}
