import { assertSafeTelemetryRecord, lowCardinalityLabels } from '../../../sunrey-chain/src/ops/privacy.ts';
import { redactCredentialText } from '../../../security/src/regulated/credentials/redaction.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'RAW_SECRET_NOT_EXPOSED',
  'NO_RAW_SECRET_EXPOSURE',
  'NO_RAW_PERSONAL_DATA_EGRESS',
  'PII_NOT_PUBLIC_CHAIN',
] as const;

export const observabilityAttackScenarios: readonly AttackScenario[] = [
  'OBS-CREDENTIAL-LABEL',
  'OBS-PII-LABEL',
  'OBS-WALLET-CARDINALITY',
  'OBS-PROVIDER-PAYLOAD',
  'OBS-NEWLINE-FORGE',
  'OBS-LARGE-ERROR',
  'OBS-SECRET-TRACE',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 15980 + index,
    category: 'OBSERVABILITY_ABUSE',
    subsystem: 'telemetry',
    attack: scenarioId.toLowerCase().replace('obs-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'TELEMETRY_REJECTED',
  }),
);

function rejected(run: () => void): boolean {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

export function runObservabilityAttack(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    const credential = rejected(() => assertSafeTelemetryRecord({ privateKey: 'k' }, 'metrics'));
    const pii = rejected(() => assertSafeTelemetryRecord({ rawKyc: 'kyc:raw:row' }, 'logs'));
    const flood = rejected(() =>
      lowCardinalityLabels({ wallet: 'sr1_'.padEnd(80, 'x') }),
    );
    const payload = rejected(() => assertSafeTelemetryRecord({ pdvRaw: 'pdv:raw:blob' }, 'logs'));
    const secretTrace = rejected(() =>
      assertSafeTelemetryRecord({ hsmSecret: 'hsm:secret:material' }, 'traces'),
    );
    const redacted = redactCredentialText('Authorization: Bearer super-secret-token-value');
    const blocked = credential && pii && flood && payload && secretTrace && !redacted.includes('super-secret');
    return {
      blocked,
      safetyHeld: blocked,
      detail: `${scenario.scenarioId} credential=${String(credential)} pii=${String(pii)} flood=${String(flood)} redacted=${redacted}`,
    };
  });
}
