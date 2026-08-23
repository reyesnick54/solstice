/**
 * Grow My Money must not encode guaranteed-return claims unless a
 * legally guaranteed product's terms explicitly support them.
 * Scenario data must distinguish projection, estimate, assumption, and
 * actual result.
 */

const FORBIDDEN = [
  /guaranteed return/i,
  /guaranteed-return/i,
  /risk-free investment gain/i,
  /certain profit/i,
  /guaranteed \$?1,?000 to \$?1,?300/i,
  /guaranteed profit/i,
  /risk-free trading/i,
  /promised return/i,
];

export function containsGuaranteedReturnClaim(value: unknown): boolean {
  return scan(value);
}

export function assertNoGuaranteedReturnClaim(value: unknown, label = 'grow payload'): void {
  if (containsGuaranteedReturnClaim(value)) {
    throw new Error(`${label} encodes a guaranteed-return claim`);
  }
}

function scan(value: unknown): boolean {
  if (typeof value === 'string') {
    return FORBIDDEN.some((re) => re.test(value));
  }
  if (Array.isArray(value)) {
    return value.some(scan);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
      if (/guaranteed[-_]?return|promised[-_]?return/i.test(key)) {
        return true;
      }
      return scan(nested);
    });
  }
  return false;
}
