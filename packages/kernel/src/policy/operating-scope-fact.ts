/**
 * Kernel / policy-layer operating-scope fact.
 *
 * Produced by the mainnet operating-scope module. Kernel still decides.
 * This file does not evaluate country law and does not issue Execution
 * Authority.
 */

export const OPERATING_SCOPE_FACT_SCHEMA_VERSION = 1 as const;

export type OperatingScopeFact = {
  readonly schemaVersion: typeof OPERATING_SCOPE_FACT_SCHEMA_VERSION;
  readonly jurisdiction: string;
  readonly activationDomain: string;
  readonly legalEntityRef?: string;
  readonly eligibility: boolean;
  readonly status: string;
  readonly reasonCodes: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly productionActive: false;
  readonly issuesExecutionAuthority: false;
  readonly confirmedByCounsel: false;
};

export function operatingScopeBlocks(fact: OperatingScopeFact): boolean {
  return !fact.eligibility || fact.reasonCodes.length > 0 && fact.status !== 'ELIGIBLE_CANDIDATE';
}

export function operatingScopeIssuesExecutionAuthority(_fact: OperatingScopeFact): false {
  return false;
}

export function acceptOperatingScopeFact(fact: OperatingScopeFact): OperatingScopeFact {
  return Object.freeze({
    schemaVersion: 1,
    jurisdiction: fact.jurisdiction,
    activationDomain: fact.activationDomain,
    ...(fact.legalEntityRef ? { legalEntityRef: fact.legalEntityRef } : {}),
    eligibility: fact.eligibility === true && fact.status === 'ELIGIBLE_CANDIDATE',
    status: fact.status,
    reasonCodes: Object.freeze([...fact.reasonCodes]),
    evidenceReferences: Object.freeze([...fact.evidenceReferences]),
    productionActive: false,
    issuesExecutionAuthority: false,
    confirmedByCounsel: false,
  });
}
