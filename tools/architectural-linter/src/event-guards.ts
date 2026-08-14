import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function finding(rule: string, file: string, line: number, message: string): Finding {
  return { rule, file, line, message };
}

/**
 * Detect a second event envelope, unversioned durable event types, and
 * event-handler ledger bypass. These are structural checks, not cosmetic
 * regex for appearance.
 */
export function lintEventFabric(root: string): Finding[] {
  const findings: Finding[] = [];
  const files = walk(root);
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (rel.startsWith('tools/architectural-linter/')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    const isTest = /\.test\.ts$/.test(rel) || rel.startsWith('tests/');
    const inEventsPackage = rel.startsWith('packages/events/');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;

      if (
        !inEventsPackage &&
        !isTest &&
        /export\s+(type|interface|class)\s+(VersionedEvent|DurableEventEnvelope|DomainEventLog|EventEnvelope)\b/.test(
          line,
        )
      ) {
        findings.push(
          finding(
            'second-event-envelope',
            rel,
            lineNo,
            'canonical event envelope lives in packages/events; do not declare a second envelope type',
          ),
        );
      }

      const looksLikeHandler =
        /event-handler|event_handler|\/consumers\/|\/handlers\//.test(rel) ||
        /EventHandler|InboxProcessor/.test(rel);
      if (
        looksLikeHandler &&
        !isTest &&
        /postJournal\s*\(/.test(line) &&
        !/function\s+postJournal/.test(line)
      ) {
        findings.push(
          finding(
            'event-handler-ledger-bypass',
            rel,
            lineNo,
            'event handlers must not call postJournal; submit a new ActionIntent to the Kernel',
          ),
        );
      }
    }

    if (inEventsPackage && /EVENT_TYPE_NAMES|export type DomainEvent/.test(source)) {
      const typeBlocks = source.match(/export type \w+V\d+ = VersionedEvent<[\s\S]*?>;/g) ?? [];
      for (const block of typeBlocks) {
        if (!/'[A-Za-z]+',\s*\n\s*\d+/.test(block) && !/,\s*1,/.test(block)) {
          findings.push(
            finding(
              'unversioned-durable-event',
              rel,
              1,
              'durable event types must be VersionedEvent with an integer schema version',
            ),
          );
        }
      }
    }
  }
  return findings;
}
