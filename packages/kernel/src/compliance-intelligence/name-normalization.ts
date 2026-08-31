/**
 * Safe name normalization for compliance screening — preserves originals.
 */

export type NormalizedName = {
  readonly original: string;
  readonly normalized: string;
  readonly tokens: readonly string[];
};

const PUNCTUATION = /[.,;:'"()\-_/\\]+/g;

export function normalizeComplianceName(name: string): NormalizedName {
  const original = name.trim();
  const unicode = original.normalize('NFKC');
  const lowered = unicode.toLowerCase();
  const depunctuated = lowered.replace(PUNCTUATION, ' ');
  const collapsed = depunctuated.replace(/\s+/g, ' ').trim();
  const tokens = collapsed.length > 0 ? Object.freeze(collapsed.split(' ')) : Object.freeze([]);
  return Object.freeze({ original, normalized: collapsed, tokens });
}

export function normalizeAliasList(aliases: readonly string[]): readonly NormalizedName[] {
  return Object.freeze(aliases.map((alias) => normalizeComplianceName(alias)));
}

/**
 * Bounded token overlap score — not an opaque AI decision.
 */
export function tokenOverlapScore(a: NormalizedName, b: NormalizedName): number {
  if (a.tokens.length === 0 || b.tokens.length === 0) return 0;
  const setB = new Set(b.tokens);
  let overlap = 0;
  for (const token of a.tokens) {
    if (setB.has(token)) overlap += 1;
  }
  return overlap / Math.max(a.tokens.length, b.tokens.length);
}

export function isExactNameMatch(a: NormalizedName, b: NormalizedName): boolean {
  return a.normalized.length > 0 && a.normalized === b.normalized;
}

export function isFuzzyNameMatch(a: NormalizedName, b: NormalizedName, threshold = 0.75): boolean {
  if (isExactNameMatch(a, b)) return false;
  return tokenOverlapScore(a, b) >= threshold;
}
