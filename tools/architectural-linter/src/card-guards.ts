import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import type { Finding } from './linter.ts';

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'coverage']);
const COMPETING_CARD_PATHS = [
  'packages/card-processing',
  'packages/issuer',
  'packages/card-core',
  'packages/wallet',
  'packages/tokenization',
  'packages/softpos',
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return out;
  }
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

export function lintCardBoundary(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const alias of COMPETING_CARD_PATHS) {
    if (existsSync(join(root, alias))) {
      findings.push(
        finding(
          'competing-card-package',
          alias,
          1,
          `competing card package '${alias}' exists; use packages/cards`,
        ),
      );
    }
  }

  const files = walk(root);
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (rel.startsWith('tools/architectural-linter/')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    const isTest = /\.test\.ts$/.test(rel) || rel.startsWith('tests/');
    const inCards = rel.startsWith('packages/cards/') || rel.startsWith('services/cards/');
    const isProcessor = /simulated-processor\.ts$/.test(rel) || /processor\.ts$/.test(rel);
    const isCallback = /callback\.ts$/.test(rel);
    const isWalletAdapter = /wallet\/adapters\.ts$/.test(rel);
    const isAcceptanceAdapter = /acceptance\/simulated\.ts$/.test(rel) || /acceptance\/port\.ts$/.test(rel);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const lineNo = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }

      if (inCards && !isTest && /^\s*(readonly\s+)?balance\s*[?:]/.test(line)) {
        findings.push(finding('card-owns-balance', rel, lineNo, 'a Card must not own a balance field'));
      }

      if (isProcessor && !isTest && /postJournal\s*\(|postCardJournal\s*\(/.test(line)) {
        findings.push(
          finding('card-adapter-posts-ledger', rel, lineNo, 'card processor adapter must not post journals'),
        );
      }

      if (isCallback && !isTest && /createHold\s*\(|holds\.reserve\s*\(/.test(line)) {
        findings.push(
          finding(
            'callback-bypasses-kernel',
            rel,
            lineNo,
            'processor callback verification must not create a hold',
          ),
        );
      }

      if (
        isProcessor &&
        !isTest &&
        /issuer\.issue\s*\(|AuthorityIssuer/.test(line) &&
        !/import type/.test(line)
      ) {
        findings.push(
          finding(
            'processor-fabricates-authority',
            rel,
            lineNo,
            'card processor must not issue Execution Authority',
          ),
        );
      }

      if (
        inCards &&
        !isTest &&
        /export\s+(type|class|function|const)\s+\w*Hold\b/.test(line) &&
        !/CardHoldGateway|HoldGatewayOutcome|holdId/.test(line)
      ) {
        findings.push(
          finding('second-hold-system', rel, lineNo, 'do not declare a second funds-hold type in cards'),
        );
      }

      if (inCards && !isTest && /parseFloat\s*\(|\bNumber\s*\(/.test(line) && /fx|rate|convert/i.test(line)) {
        findings.push(
          finding('second-fx-primitive', rel, lineNo, 'cards must not invent a floating-point FX primitive'),
        );
      }

      if (
        !isTest &&
        inCards &&
        /\b(pan|cvv|cvc|trackData|magstripe)\s*[:=]/i.test(line) &&
        !/PCI_SENSITIVE|forbidden|must not|assertNoSensitive/.test(line)
      ) {
        findings.push(
          finding('raw-pan-cvv', rel, lineNo, 'raw PAN/CVV must not appear in card domain state'),
        );
      }

      if (
        isWalletAdapter &&
        !isTest &&
        /issuer\.issue\s*\(|AuthorityIssuer/.test(line) &&
        !/import type/.test(line)
      ) {
        findings.push(
          finding(
            'wallet-adapter-issues-authority',
            rel,
            lineNo,
            'wallet adapter must not issue Execution Authority',
          ),
        );
      }

      if (
        isAcceptanceAdapter &&
        !isTest &&
        /postJournal\s*\(|postCardJournal\s*\(/.test(line)
      ) {
        findings.push(
          finding(
            'acceptance-adapter-posts-ledger',
            rel,
            lineNo,
            'acceptance adapter must not post journals',
          ),
        );
      }

      if (
        inCards &&
        !isTest &&
        /emvKernel|nfcKernel|contactlessCryptograph|implementEmv|computeARQC|computeTC\b/i.test(line)
      ) {
        findings.push(
          finding(
            'custom-emv-cryptography',
            rel,
            lineNo,
            'Solstice must not implement EMV/contactless cryptography',
          ),
        );
      }

      if (
        !isTest &&
        /providerBackendSecret|APPLE_WALLET_PRIVATE_KEY|GOOGLE_WALLET_PRIVATE_KEY/.test(line) &&
        /mobile|app config|clientConfig/i.test(line)
      ) {
        findings.push(
          finding(
            'mobile-receives-provider-secret',
            rel,
            lineNo,
            'mobile application must not receive a provider backend secret',
          ),
        );
      }

      if (
        rel.includes('constitution.test.ts') &&
        /CHUNK-12 must stop until the protected cards capability is IMPLEMENTED/.test(line)
      ) {
        findings.push(
          finding(
            'stale-chunk-12-must-stop',
            rel,
            lineNo,
            'stale CHUNK-12 mustStop assertion must not return after Cards is IMPLEMENTED',
          ),
        );
      }
    }
  }

  return findings;
}
