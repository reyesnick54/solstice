/**
 * sunrey-explorer CLI.
 *
 * run | index | rebuild | verify | status
 * The explorer never writes blockchain state.
 */

import { join } from 'node:path';

import { developmentChainFixture } from './fixtures.ts';
import { ExplorerIndexer } from './indexer.ts';
import { ExplorerQueryService } from './queries.ts';
import { startExplorerServer } from './server.ts';
import { verifyIndex } from './verify.ts';
import { canonicalProjectionHash } from './canonical.ts';

export type CliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const COMMANDS = ['run', 'index', 'rebuild', 'verify', 'status'] as const;

export function explorerUsage(): string {
  return [
    'sunrey-explorer run [--listen 127.0.0.1:8787]',
    'sunrey-explorer index [--from-height N]',
    'sunrey-explorer rebuild [--from-height N]',
    'sunrey-explorer verify',
    'sunrey-explorer status',
  ].join('\n');
}

export async function runExplorerCommand(argv: readonly string[]): Promise<CliResult> {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help') {
    return { ok: true, command: 'help', payload: explorerUsage() };
  }
  if (!(COMMANDS as readonly string[]).includes(command)) {
    return { ok: false, command, payload: explorerUsage() };
  }
  const flags = parseFlags(rest);
  const chain = developmentChainFixture(4);
  const indexer = new ExplorerIndexer(chain);
  const queries = new ExplorerQueryService(indexer);

  if (command === 'index') {
    const from = numberFlag(flags, 'from-height');
    if (from !== undefined) {
      indexer.rebuildFromHeight(from);
    } else {
      indexer.indexFromGenesis();
    }
    return { ok: true, command, payload: indexer.status() };
  }
  if (command === 'rebuild') {
    indexer.rebuildFromHeight(numberFlag(flags, 'from-height') ?? 0);
    return {
      ok: true,
      command,
      payload: { ...indexer.status(), hash: canonicalProjectionHash(indexer.store.projection()) },
    };
  }
  if (command === 'verify') {
    indexer.indexFromGenesis();
    const report = verifyIndex(indexer.store, chain);
    return { ok: report.ok, command, payload: report };
  }
  if (command === 'status') {
    indexer.catchUp();
    return { ok: true, command, payload: { ...indexer.status(), home: queries.home() } };
  }

  indexer.indexFromGenesis();
  const listen = flags['listen'] ?? '127.0.0.1:8787';
  const webRoot = join(import.meta.dirname, '..', '..', '..', 'apps', 'explorer');
  const server = await startExplorerServer(listen, queries, indexer, webRoot);
  return { ok: true, command, payload: { listen: server.listen, status: indexer.status() } };
}

function parseFlags(args: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i] ?? '';
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

function numberFlag(flags: Record<string, string>, name: string): number | undefined {
  const raw = flags[name];
  if (raw === undefined) {
    return undefined;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) ? value : undefined;
}

const invoked = process.argv[1]?.includes('sunrey-explorer') || process.argv[1]?.endsWith('cli.ts');
if (invoked && import.meta.url === `file://${process.argv[1]}`) {
  runExplorerCommand(process.argv.slice(2))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
