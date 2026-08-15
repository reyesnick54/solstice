/**
 * External market text, news, and metadata are untrusted DATA.
 * They are never treated as instructions, policy, or mandate changes.
 *
 * Reuses the Personal Economy Agent concept that model/source text is not policy.
 */
export const CONTENT_TRUST_CLASSES = ['TRUSTED_STRUCTURED_FACT', 'UNTRUSTED_EXTERNAL_DATA'] as const;
export type ContentTrustClass = (typeof CONTENT_TRUST_CLASSES)[number];

export type ClassifiedContent = {
  readonly text: string;
  readonly trust: ContentTrustClass;
  readonly treatedAsInstruction: false;
  readonly treatedAsPolicy: false;
};

const INJECTION_PATTERNS = [
  /ignore (your|all|the) rules/i,
  /invest everything/i,
  /no matter what/i,
  /override (risk|mandate|policy)/i,
  /you are now/i,
];

export function classifyExternalContent(text: string): ClassifiedContent {
  return Object.freeze({
    text,
    trust: 'UNTRUSTED_EXTERNAL_DATA',
    treatedAsInstruction: false,
    treatedAsPolicy: false,
  });
}

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function preserveAsUserObjective(text: string): {
  readonly objective: string;
  readonly guaranteedReturn: false;
  readonly relaxesRisk: false;
  readonly treatedAsInstruction: false;
} {
  return Object.freeze({
    objective: text,
    guaranteedReturn: false,
    relaxesRisk: false,
    treatedAsInstruction: false,
  });
}
