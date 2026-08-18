/**
 * Dedicated entry for `sunrey-ops validator <operator-platform-command>`.
 * Avoids loading mashed production-handoff / formal graphs.
 */

import { assertNoPrivateKeyMaterial } from '../ops/logging.ts';
import { runValidatorOperatorCommand } from './cli.ts';

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = argv[0] === 'validator' ? argv.slice(1) : argv;
  const result = runValidatorOperatorCommand(args);
  assertNoPrivateKeyMaterial(result);
  const text = JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);
  console.log(text);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

const entry = process.argv[1] ?? '';
if (
  import.meta.url === `file://${entry}` ||
  entry.endsWith('validator-operator/cli-main.ts') ||
  entry.endsWith('validator-operator/cli-main.js')
) {
  await main();
}
