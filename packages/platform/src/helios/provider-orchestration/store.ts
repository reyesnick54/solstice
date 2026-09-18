import type {
  CustodyWalletProvision,
  ExternalAccountApplication,
  FundingOperation,
  FundingRelationship,
  ProviderOrchestrationStoreSnapshot,
} from './types.ts';

export class InMemoryProviderOrchestrationStore {
  private readonly applications = new Map<string, ExternalAccountApplication>();
  private readonly fundingRelationships = new Map<string, FundingRelationship>();
  private readonly fundingOperations = new Map<string, FundingOperation>();
  private readonly walletProvisions = new Map<string, CustodyWalletProvision>();

  putApplication(application: ExternalAccountApplication): void {
    this.applications.set(application.applicationId, application);
  }

  getApplication(applicationId: string): ExternalAccountApplication | null {
    return this.applications.get(applicationId) ?? null;
  }

  findApplicationByIdempotency(customerId: string, idempotencyKey: string): ExternalAccountApplication | null {
    for (const application of this.applications.values()) {
      if (application.customerId === customerId && application.idempotencyKey === idempotencyKey) {
        return application;
      }
    }
    return null;
  }

  listApplicationsForCustomer(customerId: string): readonly ExternalAccountApplication[] {
    return Object.freeze(
      [...this.applications.values()].filter((row) => row.customerId === customerId),
    );
  }

  putFundingRelationship(relationship: FundingRelationship): void {
    this.fundingRelationships.set(relationship.relationshipId, relationship);
  }

  getFundingRelationship(relationshipId: string): FundingRelationship | null {
    return this.fundingRelationships.get(relationshipId) ?? null;
  }

  putFundingOperation(operation: FundingOperation): void {
    this.fundingOperations.set(operation.operationId, operation);
  }

  getFundingOperation(operationId: string): FundingOperation | null {
    return this.fundingOperations.get(operationId) ?? null;
  }

  findFundingByIdempotency(customerId: string, idempotencyKey: string): FundingOperation | null {
    for (const operation of this.fundingOperations.values()) {
      if (operation.customerId === customerId && operation.idempotencyKey === idempotencyKey) {
        return operation;
      }
    }
    return null;
  }

  listFundingForCustomer(customerId: string): readonly FundingOperation[] {
    return Object.freeze(
      [...this.fundingOperations.values()].filter((row) => row.customerId === customerId),
    );
  }

  putWalletProvision(provision: CustodyWalletProvision): void {
    this.walletProvisions.set(provision.provisionId, provision);
  }

  getWalletProvision(provisionId: string): CustodyWalletProvision | null {
    return this.walletProvisions.get(provisionId) ?? null;
  }

  findWalletByIdempotency(customerId: string, idempotencyKey: string): CustodyWalletProvision | null {
    for (const provision of this.walletProvisions.values()) {
      if (provision.customerId === customerId && provision.idempotencyKey === idempotencyKey) {
        return provision;
      }
    }
    return null;
  }

  listWalletsForCustomer(customerId: string): readonly CustodyWalletProvision[] {
    return Object.freeze(
      [...this.walletProvisions.values()].filter((row) => row.customerId === customerId),
    );
  }

  snapshot(): ProviderOrchestrationStoreSnapshot {
    return Object.freeze({
      applications: Object.freeze([...this.applications.values()]),
      fundingRelationships: Object.freeze([...this.fundingRelationships.values()]),
      fundingOperations: Object.freeze([...this.fundingOperations.values()]),
      walletProvisions: Object.freeze([...this.walletProvisions.values()]),
    });
  }

  hydrate(snapshot: ProviderOrchestrationStoreSnapshot): void {
    this.applications.clear();
    this.fundingRelationships.clear();
    this.fundingOperations.clear();
    this.walletProvisions.clear();
    for (const application of snapshot.applications) {
      this.applications.set(application.applicationId, application);
    }
    for (const relationship of snapshot.fundingRelationships) {
      this.fundingRelationships.set(relationship.relationshipId, relationship);
    }
    for (const operation of snapshot.fundingOperations) {
      this.fundingOperations.set(operation.operationId, operation);
    }
    for (const provision of snapshot.walletProvisions) {
      this.walletProvisions.set(provision.provisionId, provision);
    }
  }
}
