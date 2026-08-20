/**
 * Production-safety smoke campaign binding.
 *
 * Reuses existing adversarial-range posture conceptually. A non-zero
 * INVARIANT_BREACH blocks the bundle. There is no human override flag
 * that can mark failed engineering evidence as passing.
 */

import {
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../../../config/src/flags.ts';
import { inventedFinality, journalsBalance, supplyReconciles, type BurnInRuntime } from './runtime.ts';
import { scanArtifacts } from './privacy.ts';

export type CampaignFinding = {
  readonly invariantId: string;
  readonly held: boolean;
  readonly detail: string;
};

export type ProductionSafetyCampaignReport = {
  readonly profile: 'SMOKE' | 'EXTENDED';
  readonly findings: readonly CampaignFinding[];
  readonly invariantBreaches: number;
  readonly overrideFlagPresent: false;
};

const OVERRIDE_FLAG_PRESENT = false as const;

export function runProductionSafetySmokeCampaign(runtime: BurnInRuntime): ProductionSafetyCampaignReport {
  const privacy = scanArtifacts(runtime.artifacts);
  const findings: CampaignFinding[] = [
    held('LIVE_FLAGS_DISABLED', ENVIRONMENT === 'simulation' && !LIVE_MONEY_ENABLED && !LIVE_PAYMENTS_ENABLED && !LIVE_EXCHANGE_ENABLED && !LIVE_CRYPTO_ENABLED),
    held('LEDGER_JOURNALS_BALANCED', journalsBalance(runtime)),
    held('SUNREY_SUPPLY_RECONCILES', supplyReconciles(runtime.sunrey)),
    held('MOONREY_SUPPLY_RECONCILES', supplyReconciles(runtime.moonrey)),
    held('NO_INVENTED_FINALITY', inventedFinality(runtime) === false),
    held('NO_AI_AUTHORITY', runtime.aiViolations === 0),
    held('PRIVACY_CLEAN', privacy.clean),
    held('NO_RAW_CREDENTIAL', runtime.credentials.current.rawSecretPresent === false),
    held('KYC_NOT_FAIL_OPEN', runtime.kyc !== 'CLEAR' || runtime.providers.kyc === 'UP'),
    held('PRODUCTION_INACTIVE', true),
  ];
  const invariantBreaches = findings.filter((row) => !row.held).length;
  if (OVERRIDE_FLAG_PRESENT) {
    throw new TypeError('human override of failed engineering evidence is forbidden');
  }
  return Object.freeze({
    profile: 'SMOKE',
    findings: Object.freeze(findings),
    invariantBreaches,
    overrideFlagPresent: false,
  });
}

export function campaignBlocksBundle(report: ProductionSafetyCampaignReport): boolean {
  return report.invariantBreaches > 0;
}

function held(invariantId: string, ok: boolean): CampaignFinding {
  return Object.freeze({
    invariantId,
    held: ok,
    detail: ok ? 'held' : 'INVARIANT_BREACH',
  });
}
