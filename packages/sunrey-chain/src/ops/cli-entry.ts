/**
 * sunrey-ops process entry.
 *
 * RPC / Explorer commands load only the public data plane so they do not
 * depend on unrelated mashed rehearsal modules.
 */

import { assertNoPrivateKeyMaterial } from './logging.ts';

const argv = process.argv.slice(2);
const head = argv[0] ?? 'health';

if (head === 'rpc' || head === 'explorer') {
  const { runPublicDataPlaneCommand } = await import('../public-data-plane/cli.ts');
  const result = runPublicDataPlaneCommand(argv);
  assertNoPrivateKeyMaterial(result);
  console.log(JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
} else {
  const { main } = await import('./cli.ts');
  await main();
}
