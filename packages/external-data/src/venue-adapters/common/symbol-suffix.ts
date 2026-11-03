/** BYTEX engine perpetual suffix (clean-room port). */
export const HELIOS_ENGINE_PERP_SUFFIX = '-PERP' as const;

export function stripEnginePerpSuffix(symbol: string): string {
  return symbol.endsWith(HELIOS_ENGINE_PERP_SUFFIX)
    ? symbol.slice(0, -HELIOS_ENGINE_PERP_SUFFIX.length)
    : symbol;
}

export function splitCanonicalSpotPair(canonical: string): { base: string; quote: string } {
  const parts = canonical.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid canonical spot symbol ${canonical}`);
  }
  return { base: parts[0]!, quote: parts[1]! };
}
