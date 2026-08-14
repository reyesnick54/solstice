import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AgentProposalHasNoAuthority } from '../packages/contracts/src/proposal.ts';

const AGENT_ROOT = new URL('../packages/agent', import.meta.url).pathname;
const FORBIDDEN_IMPORT_NEEDLES = [
  'packages/platform',
  'ExecutionAuthority',
  'AuthorityIssuer',
  'SimulatedLedger',
  'ComplianceKernel',
  'postJournal',
  'ActionIntent',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('agent isolation (structural)', () => {
  const files = walk(join(AGENT_ROOT, 'src'));

  it('agent package.json does not depend on platform, ledger, or kernel', () => {
    const pkg = JSON.parse(readFileSync(join(AGENT_ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.equal(deps['@solstice/platform'], undefined);
    assert.equal(Object.keys(deps).some((k) => k.includes('platform')), false);
  });

  it('no agent source file imports platform, ledger, kernel, or ExecutionAuthority', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(AGENT_ROOT, file);
      const text = readFileSync(file, 'utf8');
      const importLines = text.split('\n').filter((line) => /^\s*import\s/.test(line));
      for (const line of importLines) {
        for (const needle of FORBIDDEN_IMPORT_NEEDLES) {
          if (line.includes(needle)) {
            violations.push(`${rel}: ${line.trim()}`);
          }
        }
      }
    }
    assert.deepEqual(violations, []);
  });

  it('PersonalEconomyAgent constructor ports contain no ledger or authority fields', () => {
    const ports = readFileSync(join(AGENT_ROOT, 'src/runtime/ports.ts'), 'utf8');
    const typeBlock = ports.slice(
      ports.indexOf('export type AgentRuntimePorts'),
      ports.indexOf('export function assertReadOnlyContext'),
    );
    assert.match(typeBlock, /context: FinancialContextSnapshot/);
    assert.match(typeBlock, /claims: CapabilityTokenClaims/);
    assert.match(typeBlock, /mandates: readonly CompiledMandate/);
    assert.equal(/ledger|ExecutionAuthority|AuthorityIssuer|postJournal/.test(typeBlock), false);
    assert.equal(/kernel/.test(typeBlock), false);
  });

  it('AgentProposal type has no toIntent or authority field', () => {
    const lock: AgentProposalHasNoAuthority = true;
    assert.equal(lock, true);
  });
});
