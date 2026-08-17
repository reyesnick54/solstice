/**
 * Identity-based infrastructure access. Policies bind service identity,
 * resource, operation, environment, and network zone. Default deny.
 */

import { infraErr, infraOk, type AccessOperation, type InfraEnvironment, type InfraResult, type NetworkZone, type WorkloadService } from './types.ts';
import type { WorkloadIdentity } from './identity.ts';

export type AccessResource =
  | 'PUBLIC_NODE_STATE'
  | 'FINALIZED_CHAIN_DATA'
  | 'CONSENSUS_SIGNER'
  | 'VALIDATOR_ADMIN'
  | 'CUSTODY_SIGNING_CREDENTIAL'
  | 'CUSTODY_HSM'
  | 'CUSTODY_API'
  | 'GOVERNANCE_KEY'
  | 'ORACLE_SOURCE_CREDENTIAL'
  | 'HSM_ENDPOINT'
  | 'CHAIN_MUTATION';

export type AccessPolicy = {
  readonly policyId: string;
  readonly identity: WorkloadService;
  readonly resource: AccessResource;
  readonly operation: AccessOperation;
  readonly environment: InfraEnvironment;
  readonly network: NetworkZone;
  readonly allow: boolean;
};

export const DEFAULT_ACCESS_ALLOWS: readonly Omit<AccessPolicy, 'policyId' | 'environment'>[] = Object.freeze([
  { identity: 'rpc', resource: 'PUBLIC_NODE_STATE', operation: 'READ', network: 'PUBLIC_RPC', allow: true },
  { identity: 'explorer', resource: 'FINALIZED_CHAIN_DATA', operation: 'READ', network: 'PUBLIC_EDGE', allow: true },
  { identity: 'oracle_collector', resource: 'ORACLE_SOURCE_CREDENTIAL', operation: 'RETRIEVE_SECRET', network: 'OPERATIONS_PRIVATE', allow: true },
  { identity: 'exchange', resource: 'CUSTODY_API', operation: 'READ', network: 'DATA_PRIVATE', allow: true },
  { identity: 'validator', resource: 'CONSENSUS_SIGNER', operation: 'SIGN', network: 'SIGNER_PRIVATE', allow: true },
  { identity: 'custody', resource: 'CUSTODY_SIGNING_CREDENTIAL', operation: 'RETRIEVE_SECRET', network: 'CUSTODY_PRIVATE', allow: true },
  { identity: 'custody', resource: 'CUSTODY_HSM', operation: 'ACCESS_HSM', network: 'CUSTODY_PRIVATE', allow: true },
]);

export const DEFAULT_ACCESS_DENIES: readonly Omit<AccessPolicy, 'policyId' | 'environment' | 'allow'>[] = Object.freeze([
  { identity: 'rpc', resource: 'CONSENSUS_SIGNER', operation: 'ACCESS_CONSENSUS_SIGNER', network: 'PUBLIC_RPC' },
  { identity: 'rpc', resource: 'CONSENSUS_SIGNER', operation: 'RETRIEVE_SECRET', network: 'PUBLIC_RPC' },
  { identity: 'explorer', resource: 'CUSTODY_SIGNING_CREDENTIAL', operation: 'RETRIEVE_SECRET', network: 'PUBLIC_EDGE' },
  { identity: 'explorer', resource: 'CHAIN_MUTATION', operation: 'MUTATE_CHAIN', network: 'PUBLIC_EDGE' },
  { identity: 'oracle_collector', resource: 'GOVERNANCE_KEY', operation: 'RETRIEVE_SECRET', network: 'OPERATIONS_PRIVATE' },
  { identity: 'oracle_collector', resource: 'CUSTODY_HSM', operation: 'ACCESS_HSM', network: 'OPERATIONS_PRIVATE' },
  { identity: 'relayer', resource: 'GOVERNANCE_KEY', operation: 'SIGN', network: 'OPERATIONS_PRIVATE' },
]);

export class InfrastructureAccessPolicy {
  readonly #policies: AccessPolicy[];

  constructor(environment: InfraEnvironment) {
    this.#policies = [
      ...DEFAULT_ACCESS_ALLOWS.map((row, index) =>
        Object.freeze({
          ...row,
          environment,
          policyId: `allow-${environment}-${index}`,
        }),
      ),
      ...DEFAULT_ACCESS_DENIES.map((row, index) =>
        Object.freeze({
          ...row,
          environment,
          allow: false,
          policyId: `deny-${environment}-${index}`,
        }),
      ),
    ];
  }

  list(): readonly AccessPolicy[] {
    return Object.freeze([...this.#policies]);
  }

  authorize(input: {
    readonly identity: WorkloadIdentity;
    readonly resource: AccessResource;
    readonly operation: AccessOperation;
  }): InfraResult<true> {
    const deny = this.#policies.find(
      (row) =>
        !row.allow &&
        row.identity === input.identity.service &&
        row.resource === input.resource &&
        row.operation === input.operation &&
        row.environment === input.identity.environment,
    );
    if (deny) {
      return infraErr(
        'ACCESS_DENIED',
        `${input.identity.service} cannot ${input.operation} ${input.resource}`,
      );
    }
    const allow = this.#policies.find(
      (row) =>
        row.allow &&
        row.identity === input.identity.service &&
        row.resource === input.resource &&
        row.operation === input.operation &&
        row.environment === input.identity.environment,
    );
    if (!allow) {
      return infraErr(
        'ACCESS_DENIED',
        `${input.identity.service} is denied ${input.operation} on ${input.resource} by default`,
      );
    }
    return infraOk(true);
  }
}
