/**
 * sunrey-economics CLI: supply show/verify and policy show/verify.
 */

import { auditSupply, showPolicy, showSupply, verifyPolicy } from './auditor.ts';
import { nativeAssetConstitution } from './constitution.ts';
import { categoryFramework } from './genesis.ts';
import { monetaryReadinessSummary } from './readiness.ts';
import { rehearseMonetaryConstitution } from './rehearsal.ts';
import { requiredScenarios } from './simulator.ts';
import { emptyBook } from './supply.ts';
import type { NativeMonetaryAssetId } from './types.ts';

export type EconomicsCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

function emptyBooks() {
  const constitution = nativeAssetConstitution('DEVELOPMENT_ACTIVE');
  return [
    emptyBook('SUNREY_COIN', constitution.assets[0]!.policyVersion.versionId),
    emptyBook('MOONREY_COIN', constitution.assets[1]!.policyVersion.versionId),
  ];
}

export function runEconomicsCommand(argv: readonly string[]): EconomicsCliResult {
  const [domain = 'help', verb = 'show', asset] = argv;
  if (domain === 'supply' && verb === 'show') {
    return { ok: true, command: 'supply show', payload: jsonSafe(showSupply(emptyBooks())) };
  }
  if (domain === 'supply' && verb === 'verify') {
    const report = auditSupply(emptyBooks());
    return { ok: report.ok, command: 'supply verify', payload: jsonSafe(report) };
  }
  if (domain === 'policy' && verb === 'show') {
    const id = asset === 'SUNREY_COIN' || asset === 'MOONREY_COIN' ? (asset as NativeMonetaryAssetId) : undefined;
    return { ok: true, command: 'policy show', payload: jsonSafe(showPolicy(id)) };
  }
  if (domain === 'policy' && verb === 'verify') {
    const report = verifyPolicy({
      ...(asset ? { assetId: asset } : {}),
      state: 'DEVELOPMENT_ACTIVE',
    });
    return { ok: report.ok, command: 'policy verify', payload: jsonSafe(report) };
  }
  if (domain === 'genesis') {
    return { ok: true, command: 'genesis', payload: jsonSafe(categoryFramework()) };
  }
  if (domain === 'simulate') {
    const scenarios = requiredScenarios();
    return {
      ok: Object.values(scenarios).every((row) => row.ok),
      command: 'simulate',
      payload: jsonSafe({
        classification: 'ENGINEERING_SIMULATION',
        scenarios: Object.fromEntries(
          Object.entries(scenarios).map(([name, row]) => [
            name,
            {
              ok: row.ok,
              classification: row.classification,
              sunrey: row.final.SUNREY_COIN,
              moonrey: row.final.MOONREY_COIN,
              warnings: row.warnings,
            },
          ]),
        ),
      }),
    };
  }
  if (domain === 'readiness') {
    return { ok: true, command: 'readiness', payload: jsonSafe(monetaryReadinessSummary()) };
  }
  if (domain === 'rehearsal') {
    const rehearsal = rehearseMonetaryConstitution();
    return { ok: rehearsal.supplyReconciled, command: 'rehearsal', payload: jsonSafe(rehearsal) };
  }
  return {
    ok: true,
    command: 'help',
    payload: {
      usage:
        'sunrey-economics <supply show|supply verify|policy show|policy verify|genesis|simulate|readiness|rehearsal>',
      productionMainnetUnavailable: true,
      tickerStatus: 'NOT_ASSIGNED',
    },
  };
}
