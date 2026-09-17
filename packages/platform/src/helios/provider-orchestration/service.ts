import type { Clock } from '../../../../config/src/clock.ts';
import type { CustomerId } from '../../../../domain/src/customer.ts';
import { err, ok, type Result } from '../../../../domain/src/result.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type {
  CustodyWalletAdapterPort,
  FundingAdapterPort,
  InvestmentAccountAdapterPort,
  ProviderRuntimeDiscoveryPort,
} from './adapter-port.ts';
import {
  capabilityPermitsApplication,
  capabilityPermitsCustody,
  capabilityPermitsFunding,
  discoverProviderCapabilities,
} from './capability-discovery.ts';
import { buildProviderEvidence, sealProviderOrchestrationEvidence } from './evidence.ts';
import {
  custodyWalletProvisionIdFor,
  externalAccountApplicationIdFor,
  fundingOperationIdFor,
  fundingRelationshipIdFor,
} from './ids.ts';
import { InMemoryProviderOrchestrationStore } from './store.ts';
import type {
  AccountApplicationRequest,
  CustodyWalletProvision,
  ExternalAccountApplication,
  FundingOperation,
  FundingRelationship,
  FundingRequest,
  OrchestrationFailure,
  ProviderCapabilityDiscovery,
  ProviderOrchestrationStoreSnapshot,
  WalletProvisionRequest,
} from './types.ts';

export type ProviderOrchestrationPorts = {
  readonly runtime: ProviderRuntimeDiscoveryPort;
  readonly investmentAdapters: Readonly<Record<string, InvestmentAccountAdapterPort>>;
  readonly fundingAdapters: Readonly<Record<string, FundingAdapterPort>>;
  readonly custodyAdapters: Readonly<Record<string, CustodyWalletAdapterPort>>;
};

/**
 * HELIOS provider account / funding / wallet orchestration.
 *
 * Coordinates provisioning only. Does not invent identity, accept agreements,
 * issue Execution Authority, or hold unrestricted wallet keys.
 */
export class HeliosProviderOrchestrationService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly ports: ProviderOrchestrationPorts;
  readonly store: InMemoryProviderOrchestrationStore;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly ports: ProviderOrchestrationPorts;
    readonly store?: InMemoryProviderOrchestrationStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.ports = input.ports;
    this.store = input.store ?? new InMemoryProviderOrchestrationStore();
  }

  discoverCapabilities(
    providerId: string,
    environment: AccountApplicationRequest['environment'],
  ): ProviderCapabilityDiscovery | null {
    return discoverProviderCapabilities(
      this.ports.runtime,
      providerId,
      environment,
      this.clock.now(),
    );
  }

  submitAccountApplication(
    request: AccountApplicationRequest,
  ): Result<ExternalAccountApplication, OrchestrationFailure> {
    if (request.kycState !== 'VERIFIED') {
      return err({
        code: 'KYC_INCOMPLETE',
        message: 'external account application requires verified KYC state',
      });
    }
    const discovery = this.discoverCapabilities(request.providerId, request.environment);
    if (!capabilityPermitsApplication(discovery)) {
      return err({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'provider does not support account application in current capability state',
      });
    }
    const adapter = this.ports.investmentAdapters[request.providerId];
    if (!adapter) {
      return err({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'no investment account adapter registered for provider',
      });
    }

    const existing = this.store.findApplicationByIdempotency(
      request.customerId,
      request.idempotencyKey,
    );
    if (existing) {
      return ok(existing);
    }

    const applicationId = externalAccountApplicationIdFor(
      request.customerId,
      request.idempotencyKey,
    );
    const now = this.clock.now();

    try {
      const outcome = adapter.submitApplication({
        customerId: request.customerId,
        legalIdentityRef: request.legalIdentityRef,
        kycState: request.kycState,
        jurisdiction: request.jurisdiction,
        productRequested: request.productRequested,
        accountType: request.accountType,
        requiredAgreements: request.requiredAgreements,
        idempotencyKey: request.idempotencyKey,
        workOrderRef: request.workOrderRef ?? null,
        growRef: request.growRef ?? null,
        environment: request.environment,
        now,
      });

      const evidence = this.sealEvidence('HELIOS_PROVIDER_ACCOUNT_APPLICATION', {
        applicationId,
        providerId: request.providerId,
        status: outcome.status,
        providerObjectId: outcome.providerObjectId,
      });

      const application: ExternalAccountApplication = Object.freeze({
        applicationId,
        customerId: request.customerId,
        legalIdentityRef: request.legalIdentityRef,
        kycState: request.kycState,
        jurisdiction: request.jurisdiction,
        productRequested: request.productRequested,
        providerId: request.providerId,
        accountType: request.accountType,
        requiredAgreements: request.requiredAgreements,
        idempotencyKey: request.idempotencyKey,
        workOrderRef: request.workOrderRef ?? null,
        growRef: request.growRef ?? null,
        environment: request.environment,
        status: outcome.status,
        providerAccountRef: outcome.providerAccountRef,
        internalAccountRelationId: outcome.providerAccountRef
          ? `iar_${applicationId.slice(4)}`
          : null,
        capabilityState: outcome.capabilityState,
        actionRequirements: outcome.actionRequirements,
        latestEvidence: Object.freeze({
          ...buildProviderEvidence({
            providerId: request.providerId,
            providerObjectId: outcome.providerObjectId,
            providerTimestamp: outcome.providerTimestamp,
            arrivalTimestamp: now,
            correlationId: request.idempotencyKey,
            operationId: applicationId,
            rawStatus: outcome.rawStatus,
          }),
          evidenceRef: evidence,
        }),
        createdAt: now,
        updatedAt: now,
        reconciliationRequired: outcome.status === 'UNKNOWN',
      });

      this.store.putApplication(application);
      return ok(application);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'provider error';
      if (message === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
        return err({
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: 'duplicate idempotency key with different payload',
        });
      }
      if (message === 'PROVIDER_UNAVAILABLE') {
        return err({
          code: 'PROVIDER_UNAVAILABLE',
          message: 'provider unavailable for account application',
        });
      }
      throw error;
    }
  }

  reconcileAccountApplication(
    applicationId: string,
    customerId: CustomerId,
  ): Result<ExternalAccountApplication, OrchestrationFailure> {
    const application = this.requireOwnedApplication(applicationId, customerId);
    if (!application.ok) {
      return application;
    }
    const current = application.value;
    if (current.status !== 'UNKNOWN' && current.status !== 'PENDING' && current.status !== 'SUBMITTED') {
      return ok(current);
    }
    const adapter = this.ports.investmentAdapters[current.providerId];
    if (!adapter || !current.latestEvidence?.providerObjectId) {
      return ok(current);
    }
    const now = this.clock.now();
    const outcome = adapter.queryApplication({
      providerId: current.providerId,
      providerObjectId: current.latestEvidence.providerObjectId,
      idempotencyKey: current.idempotencyKey,
      now,
    });
    const evidence = this.sealEvidence('HELIOS_PROVIDER_ACCOUNT_RECONCILE', {
      applicationId,
      status: outcome.status,
    });
    const updated: ExternalAccountApplication = Object.freeze({
      ...current,
      status: outcome.status,
      providerAccountRef: outcome.providerAccountRef ?? current.providerAccountRef,
      internalAccountRelationId:
        outcome.providerAccountRef && !current.internalAccountRelationId
          ? `iar_${applicationId.slice(4)}`
          : current.internalAccountRelationId,
      actionRequirements: outcome.actionRequirements,
      capabilityState: outcome.capabilityState ?? current.capabilityState,
      latestEvidence: Object.freeze({
        ...buildProviderEvidence({
          providerId: current.providerId,
          providerObjectId: outcome.providerObjectId,
          providerTimestamp: outcome.providerTimestamp,
          arrivalTimestamp: now,
          correlationId: current.idempotencyKey,
          operationId: applicationId,
          rawStatus: outcome.rawStatus,
        }),
        evidenceRef: evidence,
      }),
      updatedAt: now,
      reconciliationRequired: outcome.status === 'UNKNOWN',
    });
    this.store.putApplication(updated);
    return ok(updated);
  }

  registerFundingRelationship(input: {
    readonly customerId: CustomerId;
    readonly sourceAccountRef: string;
    readonly destinationProviderAccountRef: string;
    readonly currency: string;
    readonly supportedRails: readonly string[];
    readonly providerId: string;
    readonly environment: FundingRequest['environment'];
  }): Result<FundingRelationship, OrchestrationFailure> {
    const adapter = this.ports.fundingAdapters[input.providerId];
    if (!adapter) {
      return err({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'no funding adapter registered for provider',
      });
    }
    const now = this.clock.now();
    const ownership = adapter.verifyFundingOwnership({
      customerId: input.customerId,
      sourceAccountRef: input.sourceAccountRef,
      providerEvidence: null,
      now,
    });
    if (!ownership.verified) {
      return err({
        code: 'RELATIONSHIP_UNVERIFIED',
        message: ownership.reason,
      });
    }
    const relationshipId = fundingRelationshipIdFor(
      input.customerId,
      input.sourceAccountRef,
      input.destinationProviderAccountRef,
    );
    const existing = this.store.getFundingRelationship(relationshipId);
    if (existing) {
      return ok(existing);
    }
    const relationship: FundingRelationship = Object.freeze({
      relationshipId,
      customerId: input.customerId,
      sourceAccountRef: input.sourceAccountRef,
      destinationProviderAccountRef: input.destinationProviderAccountRef,
      owner: input.customerId,
      currency: input.currency,
      supportedRails: input.supportedRails,
      providerId: input.providerId,
      verificationState: 'VERIFIED',
      fundingLimitMinor: null,
      settlementBehavior: 'provider_authoritative',
      environment: input.environment,
      evidence: null,
      createdAt: now,
      updatedAt: now,
    });
    this.store.putFundingRelationship(relationship);
    return ok(relationship);
  }

  submitFundingRequest(
    request: FundingRequest,
  ): Result<FundingOperation, OrchestrationFailure> {
    const relationship = this.store.getFundingRelationship(request.relationshipId);
    if (!relationship || relationship.customerId !== request.customerId) {
      return err({
        code: 'RELATIONSHIP_UNVERIFIED',
        message: 'funding relationship missing or not customer-bound',
      });
    }
    if (relationship.verificationState !== 'VERIFIED') {
      return err({
        code: 'RELATIONSHIP_UNVERIFIED',
        message: 'funding source is not verified',
      });
    }
    const discovery = this.discoverCapabilities(request.providerId, request.environment);
    if (!capabilityPermitsFunding(discovery)) {
      return err({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'provider does not support funding in current capability state',
      });
    }
    const adapter = this.ports.fundingAdapters[request.providerId];
    if (!adapter) {
      return err({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'no funding adapter registered for provider',
      });
    }

    const existing = this.store.findFundingByIdempotency(
      request.customerId,
      request.idempotencyKey,
    );
    if (existing) {
      return ok(existing);
    }

    const operationId = fundingOperationIdFor(request.customerId, request.idempotencyKey);
    const now = this.clock.now();

    try {
      const outcome = adapter.submitFunding({
        customerId: request.customerId,
        providerId: request.providerId,
        sourceAccountRef: relationship.sourceAccountRef,
        destinationAccountRef: request.destinationAccountRef,
        amountMinor: request.amountMinor,
        currency: request.currency,
        idempotencyKey: request.idempotencyKey,
        environment: request.environment,
        now,
      });

      const evidence = this.sealEvidence('HELIOS_PROVIDER_FUNDING', {
        operationId,
        providerId: request.providerId,
        status: outcome.status,
      });

      const operation: FundingOperation = Object.freeze({
        operationId,
        relationshipId: request.relationshipId,
        customerId: request.customerId,
        providerId: request.providerId,
        destinationAccountRef: request.destinationAccountRef,
        amountMinor: request.amountMinor,
        currency: request.currency,
        idempotencyKey: request.idempotencyKey,
        status: outcome.status,
        buyingPowerCredited: false,
        environment: request.environment,
        actionRequirements: outcome.actionRequirements,
        latestEvidence: Object.freeze({
          ...buildProviderEvidence({
            providerId: request.providerId,
            providerObjectId: outcome.providerObjectId,
            providerTimestamp: outcome.providerTimestamp,
            arrivalTimestamp: now,
            correlationId: request.idempotencyKey,
            operationId,
            rawStatus: outcome.rawStatus,
          }),
          evidenceRef: evidence,
        }),
        createdAt: now,
        updatedAt: now,
        reconciliationRequired: outcome.status === 'UNKNOWN',
      });

      this.store.putFundingOperation(operation);
      return ok(operation);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'provider error';
      if (message === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
        return err({
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: 'duplicate funding idempotency key with different payload',
        });
      }
      if (message === 'PROVIDER_UNAVAILABLE') {
        return err({
          code: 'PROVIDER_UNAVAILABLE',
          message: 'provider unavailable for funding',
        });
      }
      throw error;
    }
  }

  reconcileFundingOperation(
    operationId: string,
    customerId: CustomerId,
  ): Result<FundingOperation, OrchestrationFailure> {
    const operation = this.requireOwnedFunding(operationId, customerId);
    if (!operation.ok) {
      return operation;
    }
    const current = operation.value;
    if (
      current.status !== 'UNKNOWN' &&
      current.status !== 'PENDING' &&
      current.status !== 'SETTLING' &&
      current.status !== 'ACKNOWLEDGED'
    ) {
      return ok(current);
    }
    const adapter = this.ports.fundingAdapters[current.providerId];
    if (!adapter || !current.latestEvidence?.providerObjectId) {
      return ok(current);
    }
    const now = this.clock.now();
    const outcome = adapter.queryFunding({
      providerId: current.providerId,
      providerObjectId: current.latestEvidence.providerObjectId,
      idempotencyKey: current.idempotencyKey,
      now,
    });
    const evidence = this.sealEvidence('HELIOS_PROVIDER_FUNDING_RECONCILE', {
      operationId,
      status: outcome.status,
    });
    const updated: FundingOperation = Object.freeze({
      ...current,
      status: outcome.status,
      actionRequirements: outcome.actionRequirements,
      latestEvidence: Object.freeze({
        ...buildProviderEvidence({
          providerId: current.providerId,
          providerObjectId: outcome.providerObjectId,
          providerTimestamp: outcome.providerTimestamp,
          arrivalTimestamp: now,
          correlationId: current.idempotencyKey,
          operationId,
          rawStatus: outcome.rawStatus,
        }),
        evidenceRef: evidence,
      }),
      updatedAt: now,
      reconciliationRequired: outcome.status === 'UNKNOWN',
    });
    this.store.putFundingOperation(updated);
    return ok(updated);
  }

  provisionWallet(
    request: WalletProvisionRequest,
  ): Result<CustodyWalletProvision, OrchestrationFailure> {
    const discovery = this.discoverCapabilities(
      request.custodyProviderId,
      request.environment,
    );
    if (!capabilityPermitsCustody(discovery)) {
      return err({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'custody provider does not support wallet provisioning',
      });
    }
    const adapter = this.ports.custodyAdapters[request.custodyProviderId];
    if (!adapter) {
      return err({
        code: 'PROVIDER_NOT_CONFIGURED',
        message: 'no custody wallet adapter registered',
      });
    }

    const existing = this.store.findWalletByIdempotency(
      request.customerId,
      request.idempotencyKey,
    );
    if (existing) {
      return ok(existing);
    }

    const provisionId = custodyWalletProvisionIdFor(
      request.customerId,
      request.idempotencyKey,
    );
    const now = this.clock.now();

    try {
      const outcome = adapter.submitWalletProvision({
        customerId: request.customerId,
        custodyProviderId: request.custodyProviderId,
        assetId: request.assetId,
        networkId: request.networkId,
        signingPolicyRef: request.signingPolicyRef,
        idempotencyKey: request.idempotencyKey,
        environment: request.environment,
        now,
      });

      if (outcome.signingCredentialExposed !== false) {
        return err({
          code: 'SIGNING_MATERIAL_FORBIDDEN',
          message: 'adapter attempted to expose signing credentials',
        });
      }

      const evidence = this.sealEvidence('HELIOS_PROVIDER_WALLET', {
        provisionId,
        custodyProviderId: request.custodyProviderId,
        status: outcome.status,
      });

      const provision: CustodyWalletProvision = Object.freeze({
        provisionId,
        customerId: request.customerId,
        assetId: request.assetId,
        networkId: request.networkId,
        custodyProviderId: request.custodyProviderId,
        signingPolicyRef: request.signingPolicyRef,
        environment: request.environment,
        addressOrReference: outcome.addressOrReference,
        status: outcome.status,
        idempotencyKey: request.idempotencyKey,
        latestEvidence: Object.freeze({
          ...buildProviderEvidence({
            providerId: request.custodyProviderId,
            providerObjectId: outcome.providerObjectId,
            providerTimestamp: outcome.providerTimestamp,
            arrivalTimestamp: now,
            correlationId: request.idempotencyKey,
            operationId: provisionId,
            rawStatus: outcome.rawStatus,
          }),
          evidenceRef: evidence,
        }),
        createdAt: now,
        updatedAt: now,
        reconciliationRequired: outcome.status === 'UNKNOWN',
      });

      this.store.putWalletProvision(provision);
      return ok(provision);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'provider error';
      if (message === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
        return err({
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          message: 'duplicate wallet idempotency key with different payload',
        });
      }
      if (message === 'PROVIDER_UNAVAILABLE') {
        return err({
          code: 'PROVIDER_UNAVAILABLE',
          message: 'custody provider unavailable',
        });
      }
      throw error;
    }
  }

  getApplicationForCustomer(
    applicationId: string,
    customerId: CustomerId,
  ): Result<ExternalAccountApplication, OrchestrationFailure> {
    return this.requireOwnedApplication(applicationId, customerId);
  }

  getFundingForCustomer(
    operationId: string,
    customerId: CustomerId,
  ): Result<FundingOperation, OrchestrationFailure> {
    return this.requireOwnedFunding(operationId, customerId);
  }

  getWalletForCustomer(
    provisionId: string,
    customerId: CustomerId,
  ): Result<CustodyWalletProvision, OrchestrationFailure> {
    const provision = this.store.getWalletProvision(provisionId);
    if (!provision) {
      return err({ code: 'NOT_FOUND', message: 'wallet provision not found' });
    }
    if (provision.customerId !== customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'wallet belongs to another customer' });
    }
    return ok(provision);
  }

  listActionRequirements(customerId: CustomerId): readonly import('./types.ts').CustomerActionRequirement[] {
    const requirements: import('./types.ts').CustomerActionRequirement[] = [];
    for (const application of this.store.listApplicationsForCustomer(customerId)) {
      if (application.status === 'ACTION_REQUIRED') {
        requirements.push(...application.actionRequirements);
      }
    }
    for (const operation of this.store.listFundingForCustomer(customerId)) {
      if (operation.status === 'ACTION_REQUIRED') {
        requirements.push(...operation.actionRequirements);
      }
    }
    return Object.freeze(requirements);
  }

  /** Agent and HELIOS research runtimes must never receive signing material. */
  exposeWalletToAgent(
    provisionId: string,
    customerId: CustomerId,
  ): Result<never, OrchestrationFailure> {
    const wallet = this.getWalletForCustomer(provisionId, customerId);
    if (!wallet.ok) {
      return wallet;
    }
    return err({
      code: 'SIGNING_MATERIAL_FORBIDDEN',
      message: 'research agents cannot receive wallet credentials or unrestricted signing access',
    });
  }

  /** HELIOS coordinates provisioning; it is never legal account owner. */
  assertHeliosNotAccountOwner(): { readonly heliosIsAccountOwner: false; readonly customerBound: true } {
    return Object.freeze({
      heliosIsAccountOwner: false,
      customerBound: true,
    });
  }

  snapshot(): ProviderOrchestrationStoreSnapshot {
    return this.store.snapshot();
  }

  static fromSnapshot(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly ports: ProviderOrchestrationPorts;
    readonly snapshot: ProviderOrchestrationStoreSnapshot;
  }): HeliosProviderOrchestrationService {
    const store = new InMemoryProviderOrchestrationStore();
    store.hydrate(input.snapshot);
    return new HeliosProviderOrchestrationService({
      clock: input.clock,
      evidence: input.evidence,
      ports: input.ports,
      store,
    });
  }

  private requireOwnedApplication(
    applicationId: string,
    customerId: CustomerId,
  ): Result<ExternalAccountApplication, OrchestrationFailure> {
    const application = this.store.getApplication(applicationId);
    if (!application) {
      return err({ code: 'NOT_FOUND', message: 'account application not found' });
    }
    if (application.customerId !== customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'application belongs to another customer' });
    }
    return ok(application);
  }

  private requireOwnedFunding(
    operationId: string,
    customerId: CustomerId,
  ): Result<FundingOperation, OrchestrationFailure> {
    const operation = this.store.getFundingOperation(operationId);
    if (!operation) {
      return err({ code: 'NOT_FOUND', message: 'funding operation not found' });
    }
    if (operation.customerId !== customerId) {
      return err({ code: 'CUSTOMER_MISMATCH', message: 'funding operation belongs to another customer' });
    }
    return ok(operation);
  }

  private sealEvidence(kind: string, detail: Record<string, unknown>): string | null {
    if (!this.evidence) {
      return null;
    }
    return sealProviderOrchestrationEvidence(this.evidence, kind, detail);
  }
}
