/**
 * Evidence classification and fixture firewall.
 *
 * ENGINEERING cannot satisfy EXTERNAL or HUMAN.
 * AI / S3M / Grok / agent / automation / service cannot satisfy HUMAN.
 */

import type {
  ActivationEvidenceRecord,
  EconomicActorKind,
  HumanAuthorizationSlot,
  RequirementEvidenceClass,
} from './types.ts';

export const FIXTURE_KINDS = [
  'SIMULATION_HSM',
  'SANDBOX_PROVIDER',
  'FAKE_CONTRACT',
  'FIXTURE_HUMAN_SIGNATURE',
  'REHEARSAL_GENESIS',
  'TESTNET_FAUCET',
  'ENGINEERING_ORACLE',
  'SYNTHETIC_HIN',
] as const;
export type FixtureKind = (typeof FIXTURE_KINDS)[number];

const NON_HUMAN: ReadonlySet<EconomicActorKind> = new Set([
  'AI',
  'S3M',
  'GROK',
  'AGENT',
  'AUTOMATION',
  'SERVICE',
]);

export function evidenceClassSatisfies(
  provided: RequirementEvidenceClass | string,
  required: RequirementEvidenceClass,
): boolean {
  if (required === 'ENGINEERING') {
    return provided === 'ENGINEERING' || provided === 'EXTERNAL' || provided === 'HUMAN';
  }
  if (required === 'EXTERNAL') {
    return provided === 'EXTERNAL';
  }
  if (required === 'HUMAN') {
    return provided === 'HUMAN';
  }
  return provided === required;
}

export function isNonHumanActor(actorKind: EconomicActorKind | null | undefined): boolean {
  if (!actorKind) {
    return false;
  }
  return NON_HUMAN.has(actorKind);
}

export function actorLooksNonHuman(actorId: string, actorKind: EconomicActorKind): boolean {
  if (isNonHumanActor(actorKind)) {
    return true;
  }
  const lowered = actorId.toLowerCase();
  return (
    lowered.includes('ai-') ||
    lowered.startsWith('ai_') ||
    lowered.includes('s3m') ||
    lowered.includes('grok') ||
    lowered.includes('agent.') ||
    lowered.includes('automation') ||
    lowered.includes('service.')
  );
}

export function isFixtureEvidence(record: ActivationEvidenceRecord): boolean {
  if (record.fixture) {
    return true;
  }
  if (record.fixtureKind && (FIXTURE_KINDS as readonly string[]).includes(record.fixtureKind)) {
    return true;
  }
  const haystack = `${record.evidenceId} ${record.description} ${record.reference ?? ''}`.toLowerCase();
  return (
    haystack.includes('fixture') ||
    haystack.includes('simulation hsm') ||
    haystack.includes('sandbox provider') ||
    haystack.includes('fake contract') ||
    haystack.includes('rehearsal genesis') ||
    haystack.includes('testnet faucet') ||
    haystack.includes('engineering oracle') ||
    haystack.includes('synthetic hin')
  );
}

export function humanSlotSatisfied(slot: HumanAuthorizationSlot): {
  readonly ok: boolean;
  readonly aiAttempt: boolean;
  readonly fixtureAttempt: boolean;
} {
  if (slot.fixtureSignature) {
    return { ok: false, aiAttempt: false, fixtureAttempt: true };
  }
  if (actorLooksNonHuman(slot.actorId, slot.actorKind)) {
    return { ok: false, aiAttempt: true, fixtureAttempt: false };
  }
  return { ok: slot.accepted && slot.actorKind === 'HUMAN', aiAttempt: false, fixtureAttempt: false };
}

export function partitionEvidence(records: readonly ActivationEvidenceRecord[]): {
  readonly engineering: readonly ActivationEvidenceRecord[];
  readonly external: readonly ActivationEvidenceRecord[];
  readonly human: readonly ActivationEvidenceRecord[];
} {
  return {
    engineering: records.filter((row) => row.evidenceClass === 'ENGINEERING'),
    external: records.filter((row) => row.evidenceClass === 'EXTERNAL'),
    human: records.filter((row) => row.evidenceClass === 'HUMAN'),
  };
}
