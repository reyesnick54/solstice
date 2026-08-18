/**
 * sunrey-launch economic-* commands.
 *
 * None of these publish production genesis, launch production validators,
 * enable live Exchange/custody/fiat rails, migrate customer funds,
 * assign tickers, or activate production monetary policies.
 */

import {
  economicRehearsalDoesNotActivateProduction,
  runEconomicRehearsal,
  type EconomicRehearsalSession,
} from './engine.ts';
import { buildEconomicGenesis } from './genesis.ts';
import { buildEconomicRcBundle, verifyEconomicRc } from './rc.ts';
import { runEconomicStressCampaign } from './stress.ts';

export type EconomicCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, inner) => (typeof inner === 'bigint' ? inner.toString() : inner)),
  );
}

let cached: EconomicRehearsalSession | null = null;

export function resetEconomicCliCache(): void {
  cached = null;
}

function session(root = process.cwd()): EconomicRehearsalSession {
  cached ??= runEconomicRehearsal(root);
  return cached;
}

export function runEconomicLaunchCommand(argv: readonly string[], root = process.cwd()): EconomicCliResult {
  const [command = 'help'] = argv;
  if (command === 'economic-rehearse') {
    resetEconomicCliCache();
    const ran = session(root);
    economicRehearsalDoesNotActivateProduction(ran);
    return {
      ok: ran.report.productionAuthorized === false && ran.report.liveFlagsRemainDisabled,
      command: 'economic-rehearse',
      payload: jsonSafe({
        rehearsalId: ran.report.rehearsalId,
        displayName: ran.report.displayName,
        genesisHash: ran.report.rehearsalGenesis.genesisHash,
        economicRc: ran.report.economicRc.rcId,
        sunreySupply: ran.report.sunreySupply.observedTotal,
        moonreySupply: ran.report.moonreySupply.observedTotal,
        classification: ran.report.classification,
        productionAuthorized: false,
      }),
    };
  }
  if (command === 'economic-status') {
    return { ok: true, command: 'economic-status', payload: jsonSafe(session(root).report.controlRoom) };
  }
  if (command === 'economic-verify') {
    const ran = session(root);
    const genesis = buildEconomicGenesis();
    const rc = buildEconomicRcBundle(root);
    return {
      ok: genesis.verification.ok && verifyEconomicRc(rc) && ran.report.productionAuthorized === false,
      command: 'economic-verify',
      payload: jsonSafe({
        genesis: genesis.verification,
        economicRc: rc,
        productionAuthorized: false,
        liveFlagsRemainDisabled: true,
      }),
    };
  }
  if (command === 'economic-audit') {
    const ran = session(root);
    return {
      ok: ran.report.sunreySupply.exact && ran.report.moonreySupply.exact && ran.report.treasury.reconciled,
      command: 'economic-audit',
      payload: jsonSafe({
        sunrey: ran.report.sunreySupply,
        moonrey: ran.report.moonreySupply,
        fees: ran.report.fees,
        treasury: ran.report.treasury,
        exchange: ran.report.exchange,
        validators: ran.report.validatorEconomics,
      }),
    };
  }
  if (command === 'economic-stress') {
    const stress = runEconomicStressCampaign(process.cwd());
    return {
      ok: stress.accountingSafe,
      command: 'economic-stress',
      payload: jsonSafe(stress),
    };
  }
  if (command === 'economic-report') {
    return { ok: true, command: 'economic-report', payload: jsonSafe(session(root).report) };
  }
  if (command === 'economic-evidence') {
    return { ok: true, command: 'economic-evidence', payload: jsonSafe(session(root).evidence) };
  }
  return {
    ok: true,
    command: 'help',
    payload: {
      usage:
        'sunrey-launch <economic-rehearse|economic-status|economic-verify|economic-audit|economic-stress|economic-report|economic-evidence>',
      launchesProduction: false,
      banner: 'ECONOMIC MAINNET REHEARSAL',
    },
  };
}
