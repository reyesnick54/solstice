export const MD01_MARKET_OBSERVATION_ONLY = 'MARKET_OBSERVATION_ONLY' as const;

export type Md01AuthorityClass = typeof MD01_MARKET_OBSERVATION_ONLY;

/** Structural guard — market-data events never mint Execution Authority. */
export const MD01_GRANTS_EXECUTION_AUTHORITY = false as const;
