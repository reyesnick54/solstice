export const ALT01_REFERENCE_AND_RESEARCH_ONLY = 'REFERENCE_AND_RESEARCH_ONLY' as const;

export type Alt01AuthorityClass = typeof ALT01_REFERENCE_AND_RESEARCH_ONLY;

/** Alternative-data observations and features never grant Execution Authority. */
export const ALT01_GRANTS_EXECUTION_AUTHORITY = false as const;
