import type { KnowledgeGraphDomain, KnowledgeNodeClass } from './ontology.ts';
import { PSEUDONYMOUS_NODE_CLASSES } from './ontology.ts';

/** Payload keys that must never appear on human-economy graph nodes without explicit authorization. */
export const FORBIDDEN_HUMAN_PAYLOAD_KEYS = Object.freeze([
  'name',
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'health',
  'dna',
  'genetic',
  'communication',
  'communications',
  'locationHistory',
  'financialHistory',
  'address',
  'ssn',
  'nationalId',
  'biometric',
]);

export type HumanPrivacyViolation = {
  readonly code: 'FORBIDDEN_HUMAN_PAYLOAD' | 'MISSING_PSEUDONYM' | 'RAW_DOSSIER_PATTERN';
  readonly message: string;
};

export function isPseudonymousReference(ref: string): boolean {
  const normalized = ref.trim().toLowerCase();
  return (
    normalized.startsWith('pseudonym:') ||
    normalized.startsWith('hisub_') ||
    normalized.startsWith('easub_') ||
    normalized.startsWith('subj_') ||
    normalized.startsWith('peg_psn_')
  );
}

export function scanForbiddenHumanPayload(
  payload: Readonly<Record<string, unknown>>,
): readonly HumanPrivacyViolation[] {
  const violations: HumanPrivacyViolation[] = [];
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_HUMAN_PAYLOAD_KEYS.includes(key)) {
      violations.push(
        Object.freeze({
          code: 'FORBIDDEN_HUMAN_PAYLOAD',
          message: `human graph payload must not include ${key}`,
        }),
      );
    }
  }
  return Object.freeze(violations);
}

export function assertHumanNodePrivacy(
  nodeClass: KnowledgeNodeClass,
  domain: KnowledgeGraphDomain,
  externalRef: string | null,
  payload: Readonly<Record<string, unknown>>,
): readonly HumanPrivacyViolation[] {
  const violations = [...scanForbiddenHumanPayload(payload)];
  if (PSEUDONYMOUS_NODE_CLASSES.has(nodeClass)) {
    if (!externalRef || !isPseudonymousReference(externalRef)) {
      violations.push(
        Object.freeze({
          code: 'MISSING_PSEUDONYM',
          message: 'human economy nodes require a pseudonymous external reference',
        }),
      );
    }
  }
  if (
    domain === 'HUMAN_ECONOMY' &&
    Object.keys(payload).length > 8 &&
    !payload.contributionClass &&
    !payload.contributionRef
  ) {
    violations.push(
      Object.freeze({
        code: 'RAW_DOSSIER_PATTERN',
        message: 'human graph must link verified contributions, not raw personal dossiers',
      }),
    );
  }
  return Object.freeze(violations);
}
