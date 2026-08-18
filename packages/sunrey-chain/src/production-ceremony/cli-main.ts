/**
 * sunrey-ceremony dispatcher.
 *
 * `production *` commands run Chunk 85. All other commands remain the
 * Chunk 64 root-of-trust ceremony CLI.
 */

import { runSunreyCeremony } from '../../../security/src/ceremony/cli.ts';
import { runProductionCeremonyCommand } from './cli.ts';

export function dispatchSunreyCeremony(argv: readonly string[]): { readonly ok: boolean; readonly payload: unknown } {
  if (argv[0] === 'production') {
    const result = runProductionCeremonyCommand(argv.slice(1));
    return { ok: result.ok, payload: result.payload };
  }
  const result = runSunreyCeremony(argv);
  return { ok: result.ok, payload: result.payload };
}

function main(): void {
  const result = dispatchSunreyCeremony(process.argv.slice(2));
  process.stdout.write(
    `${JSON.stringify(result.payload, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner), 2)}\n`,
  );
  process.exitCode = result.ok ? 0 : 1;
}

const invoked = process.argv[1]?.includes('production-ceremony/cli-main');
if (invoked) {
  main();
}
