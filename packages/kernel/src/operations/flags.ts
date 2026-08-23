export type OperationsControlFlags = {
  readonly CORE_CODE_COMPLETE_CANDIDATE: true;
  readonly PRODUCTION_READY: false;
  readonly PRODUCTION_ACTIVE: false;
  readonly LIVE_CONNECTIVITY_ENABLED: false;
  readonly productionAuthorized: false;
  readonly staffCanPostJournal: false;
  readonly staffCanIssueExecutionAuthority: false;
  readonly staffCanAccessCustodyKeys: false;
  readonly staffCanActivateProduction: false;
  readonly unrestrictedImpersonation: false;
};

export const OPERATIONS_CONTROL_FLAGS: OperationsControlFlags = Object.freeze({
  CORE_CODE_COMPLETE_CANDIDATE: true,
  PRODUCTION_READY: false,
  PRODUCTION_ACTIVE: false,
  LIVE_CONNECTIVITY_ENABLED: false,
  productionAuthorized: false,
  staffCanPostJournal: false,
  staffCanIssueExecutionAuthority: false,
  staffCanAccessCustodyKeys: false,
  staffCanActivateProduction: false,
  unrestrictedImpersonation: false,
});
