import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const ROOT = process.cwd();

export function lintGrowConsumerAuthority(root = ROOT): Finding[] {
  const findings: Finding[] = [];
  const paperCycle = join(root, 'services/api/src/consumer/grow-paper-cycle.ts');
  if (!existsSync(paperCycle)) {
    return findings;
  }
  const source = readFileSync(paperCycle, 'utf8');
  if (!/serverOwned:\s*true/.test(source)) {
    findings.push({
      rule: 'grow-consumer-server-owned',
      file: 'services/api/src/consumer/grow-paper-cycle.ts',
      line: 1,
      message: 'Grow HELIOS BFF projection must mark responses serverOwned',
    });
  }
  if (!/frontendMathAuthoritative:\s*false/.test(source) && !/buildPaperGrowOverview/.test(source)) {
    findings.push({
      rule: 'grow-consumer-no-frontend-math',
      file: 'services/api/src/consumer/grow-paper-cycle.ts',
      line: 1,
      message: 'Grow HELIOS BFF must not expose frontendMathAuthoritative true',
    });
  }
  if (/clientInstructionsTrusted:\s*true|frontendMathAuthoritative:\s*true/.test(source)) {
    findings.push({
      rule: 'grow-consumer-fabricated-authority',
      file: 'services/api/src/consumer/grow-paper-cycle.ts',
      line: 1,
      message: 'Grow consumer BFF must not claim client-side financial authority',
    });
  }
  const secretPatterns = [
    /signingKey/i,
    /rawToken/i,
    /custodyCredential/i,
    /secretRef/i,
    /apiKey/i,
  ];
  for (const pattern of secretPatterns) {
    if (pattern.test(source)) {
      findings.push({
        rule: 'grow-consumer-no-secret-leakage',
        file: 'services/api/src/consumer/grow-paper-cycle.ts',
        line: 1,
        message: 'Grow consumer BFF must not expose provider secrets or signing material',
      });
      break;
    }
  }
  return findings;
}
