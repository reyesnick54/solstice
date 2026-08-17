/**
 * Workload identity. Each production service receives a distinct identity.
 * There is no shared global production service credential.
 */

import { secretRef, type SecretReference } from '../../../security/src/secrets.ts';
import {
  infraErr,
  infraOk,
  WORKLOAD_SERVICES,
  type InfraEnvironment,
  type InfraResult,
  type NetworkZone,
  type WorkloadService,
} from './types.ts';

export const WORKLOAD_ZONE: Readonly<Record<WorkloadService, NetworkZone>> = Object.freeze({
  validator: 'VALIDATOR_PRIVATE',
  sentry: 'SENTRY',
  rpc: 'PUBLIC_RPC',
  explorer: 'PUBLIC_EDGE',
  exchange: 'DATA_PRIVATE',
  custody: 'CUSTODY_PRIVATE',
  oracle_collector: 'OPERATIONS_PRIVATE',
  relayer: 'OPERATIONS_PRIVATE',
  monitoring: 'OBSERVABILITY',
  backup: 'BACKUP',
  release_service: 'OPERATIONS_PRIVATE',
});

export type WorkloadIdentity = {
  readonly identityId: string;
  readonly service: WorkloadService;
  readonly environment: InfraEnvironment;
  readonly credentialRef: SecretReference;
  readonly zone: NetworkZone;
  readonly sharedGlobalCredential: false;
};

export class WorkloadIdentityRegistry {
  readonly #identities = new Map<string, WorkloadIdentity>();

  register(input: {
    readonly service: WorkloadService;
    readonly environment: InfraEnvironment;
    readonly providerId?: string;
  }): WorkloadIdentity {
    if (!(WORKLOAD_SERVICES as readonly string[]).includes(input.service)) {
      throw new TypeError(`unknown workload service ${input.service}`);
    }
    const identityId = `wid_${input.environment.toLowerCase()}_${input.service}`;
    const existing = this.#identities.get(identityId);
    if (existing) {
      return existing;
    }
    const identity: WorkloadIdentity = Object.freeze({
      identityId,
      service: input.service,
      environment: input.environment,
      credentialRef: secretRef(input.providerId ?? 'local-infra', `workload/${input.environment}/${input.service}`),
      zone: WORKLOAD_ZONE[input.service],
      sharedGlobalCredential: false,
    });
    this.#identities.set(identityId, identity);
    return identity;
  }

  get(identityId: string): WorkloadIdentity | undefined {
    return this.#identities.get(identityId);
  }

  byService(service: WorkloadService, environment: InfraEnvironment): WorkloadIdentity | undefined {
    return this.#identities.get(`wid_${environment.toLowerCase()}_${service}`);
  }

  list(): readonly WorkloadIdentity[] {
    return Object.freeze([...this.#identities.values()]);
  }

  assertDistinct(environment: InfraEnvironment): InfraResult<true> {
    const rows = this.list().filter((row) => row.environment === environment);
    const refs = new Set(rows.map((row) => row.credentialRef.href));
    if (refs.size !== rows.length) {
      return infraErr('SHARED_CREDENTIAL', 'workload identities must not share a global production credential');
    }
    const services = new Set(rows.map((row) => row.service));
    if (services.size !== rows.length) {
      return infraErr('DUPLICATE_IDENTITY', 'each service must have a distinct workload identity');
    }
    return infraOk(true);
  }

  requireAllServices(environment: InfraEnvironment): InfraResult<readonly WorkloadIdentity[]> {
    const missing = WORKLOAD_SERVICES.filter((service) => !this.byService(service, environment));
    if (missing.length > 0) {
      return infraErr('IDENTITY_INCOMPLETE', `missing workload identities: ${missing.join(',')}`);
    }
    return infraOk(WORKLOAD_SERVICES.map((service) => this.byService(service, environment)!));
  }
}

export function defaultWorkloadIdentities(
  environment: InfraEnvironment,
  providerId = 'local-infra',
): WorkloadIdentityRegistry {
  const registry = new WorkloadIdentityRegistry();
  for (const service of WORKLOAD_SERVICES) {
    registry.register({ service, environment, providerId });
  }
  return registry;
}
