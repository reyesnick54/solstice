/**
 * Chunk 143 — production economic activation cannot be flipped by
 * editing one boolean. Activation functions do not exist.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { Finding } from './linter.ts';

const COMPETING = [
  'packages/production-economics',
  'packages/monetary-activation',
  'packages/mainnet-economics',
  'packages/tokenomics-v2',
  'packages/launch-economics',
  'packages/tokenomics',
  'packages/economic-parameters',
  'packages/monetary-policy-v2',
  'packages/coin-supply',
  'packages/production-mint',
  'packages/economic-governance-v2',
  'packages/production-authorization',
  'packages/mint-governance',
] as const;

const FIREWALL_DIR = 'packages/sunrey-chain/src/economics/production-activation';
const FLAGS = 'packages/config/src/flags.ts';
const ASSETS = 'packages/sunrey-chain/src/protocol/assets.ts';

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function finding(file: string, message: string): Finding {
  return { rule: 'production-economic-activation-guard', file, line: 1, message };
}

export function lintProductionEconomicActivation(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const rel of COMPETING) {
    if (existsSync(join(root, rel))) {
      findings.push(
        finding(rel, 'competing production-economics package is forbidden; use packages/sunrey-chain/src/economics/production-activation'),
      );
    }
  }

  const firewallRoot = join(root, FIREWALL_DIR);
  if (!existsSync(firewallRoot)) {
    findings.push(finding(FIREWALL_DIR, 'production economic activation firewall is missing'));
    return findings;
  }

  for (const file of walk(firewallRoot)) {
    if (file.endsWith('.test.ts') || file.endsWith('demo.ts') || file.endsWith('fixtures.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (/function\s+activateProduction\s*\(/.test(source) || /function\s+enableMainnetMoney\s*\(/.test(source)) {
      findings.push(finding(file, 'production activation functions are forbidden in Chunk 143'));
    }
    if (/function\s+turnOnMoonRey\s*\(/.test(source) || /function\s+turnOnSunRey\s*\(/.test(source)) {
      findings.push(finding(file, 'turnOnMoonRey/turnOnSunRey are forbidden'));
    }
    if (/productionActivated\s*[:=]\s*true/.test(source)) {
      findings.push(finding(file, 'productionActivated must remain false; it cannot be flipped by one boolean'));
    }
  }

  const flags = readFileSync(join(root, FLAGS), 'utf8');
  for (const name of [
    'LIVE_MONEY_ENABLED',
    'LIVE_PAYMENTS_ENABLED',
    'LIVE_BANKING_RAILS',
    'LIVE_EXTERNAL_KYC',
    'LIVE_EXTERNAL_BANK_CONNECTION',
    'REAL_MONEY_ENABLED',
    'LIVE_TRADING_ENABLED',
    'LIVE_CRYPTO_ENABLED',
    'LIVE_EXCHANGE_ENABLED',
    'LIVE_DATA_MARKET_ENABLED',
    'LIVE_INVESTMENT_EXECUTION',
    'LIVE_INFORMATION_RIGHTS_MARKETPLACE',
    'LIVE_DATA_MONETIZATION_ENABLED',
    'LIVE_HIN_BASED_ISSUANCE_ENABLED',
    'LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED',
  ]) {
    if (new RegExp(`${name}\\s*=\\s*true`).test(flags)) {
      findings.push(finding(FLAGS, `${name} must remain false`));
    }
  }
  if (!/export const ENVIRONMENT = 'simulation'/.test(flags)) {
    findings.push(finding(FLAGS, 'ENVIRONMENT must remain simulation'));
  }

  const assets = readFileSync(join(root, ASSETS), 'utf8');
  if (/moonreyIssuanceActivated\(\):\s*true/.test(assets) || /function moonreyIssuanceActivated[\s\S]*return true/.test(assets)) {
    findings.push(finding(ASSETS, 'moonreyIssuanceActivated() must remain false'));
  }

  return findings;
}
