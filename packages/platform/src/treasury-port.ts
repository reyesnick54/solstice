/**
 * Optional public-economic context. Absence is a missing-fact, not a second
 * Treasury implementation. Do not create packages/treasury in this chunk.
 */
export type TreasuryPublicContext = {
  readonly asOf: string;
  readonly notes: readonly string[];
};

export interface TreasuryContextPort {
  readonly readPublicContext: () => TreasuryPublicContext | undefined;
}

export const absentTreasuryContextPort: TreasuryContextPort = {
  readPublicContext() {
    return undefined;
  },
};
