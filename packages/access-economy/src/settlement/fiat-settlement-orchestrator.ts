/**
 * ACCESS Wave 3 Prompt 35 — Fiat settlement orchestrator.
 *
 * Coordinates entitlement reservation, funding reservation, user contribution,
 * provider payment, canonical fiat ledger, evidence, and transaction state.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  accessDomainSettlementIdFor,
  accessEvidenceRefFor,
  type AccessDomainSettlementId,
} from '../domain/ids.ts';
import type { AccessSolvencyService } from '../funding-solvency/solvency-service.ts';
import { allocateProportionalRefund, settlementFailure, sourceOfFundsFromPlan, validateSettlementPlan } from './invariants.ts';
import { assertRailCapability, type AccessPaymentRail } from './payment-rail.ts';
import type {
  CanonicalFiatLedgerPort,
  ComplianceGatePort,
  SettlementEvidencePort,
  UserFundingPort,
} from './ports.ts';
import type {
  AccessRefundAllocation,
  AccessSettlementPlan,
  AccessSettlementRecord,
  AccessSettlementSourceOfFunds,
} from './types.ts';
import type { AccessSettlementOperation, AccessSettlementOrchestrationStatus } from './taxonomy.ts';

export type FiatAccessSettlementOrchestratorDeps = {
  readonly solvency: AccessSolvencyService;
  readonly paymentRail: AccessPaymentRail;
  readonly userFunding: UserFundingPort;
  readonly compliance: ComplianceGatePort;
  readonly fiatLedger: CanonicalFiatLedgerPort;
  readonly evidence: SettlementEvidencePort;
};

export type SettlementOperationResult<T> =
  | { readonly ok: true; readonly settlement: AccessSettlementRecord; readonly value?: T }
  | { readonly ok: false; readonly settlement: AccessSettlementRecord | null; readonly failure: import('./types.ts').AccessSettlementFailure };

function emptyEvidence(): AccessSettlementRecord['evidence'] {
  return Object.freeze({
    checkoutQuoteRef: null,
    fundingReservationRef: null,
    entitlementReservationRef: null,
    complianceRef: null,
    userAuthorizationRef: null,
    providerAuthorizationRef: null,
    captureRef: null,
    voidRef: null,
    refundRef: null,
    canonicalLedgerRef: null,
  });
}

export class FiatAccessSettlementOrchestrator {
  private readonly deps: FiatAccessSettlementOrchestratorDeps;
  private readonly settlements = new Map<string, AccessSettlementRecord>();
  private readonly operationIdempotency = new Map<string, AccessSettlementRecord>();

  constructor(deps: FiatAccessSettlementOrchestratorDeps) {
    this.deps = deps;
  }

  private idempotencyKey(
    settlementId: string,
    operation: AccessSettlementOperation,
    key: string,
  ): string {
    return `${settlementId}:${operation}:${key}`;
  }

  private updateSettlement(
    current: AccessSettlementRecord,
    patch: Partial<AccessSettlementRecord> & { readonly status: AccessSettlementOrchestrationStatus },
  ): AccessSettlementRecord {
    const next: AccessSettlementRecord = Object.freeze({
      ...current,
      ...patch,
      evidence: Object.freeze({ ...current.evidence, ...(patch.evidence ?? {}) }),
      updatedAt: patch.updatedAt ?? current.updatedAt,
    });
    this.settlements.set(current.settlementId, next);
    return next;
  }

  prepareSettlement(input: {
    readonly plan: AccessSettlementPlan;
    readonly settlementId?: AccessDomainSettlementId;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): SettlementOperationResult<void> {
    const idemKey = this.idempotencyKey(
      input.settlementId ?? 'pending',
      'PREPARE',
      input.idempotencyKey,
    );
    const prior = this.operationIdempotency.get(idemKey);
    if (prior) {
      return { ok: true, settlement: prior };
    }

    const planFailure = validateSettlementPlan(input.plan);
    if (planFailure) {
      return { ok: false, settlement: null, failure: planFailure };
    }

    if (input.plan.expiresAt <= input.now) {
      return {
        ok: false,
        settlement: null,
        failure: settlementFailure('QUOTE_EXPIRED', 'settlement plan has expired'),
      };
    }

    const settlementId =
      input.settlementId ?? accessDomainSettlementIdFor(`${input.plan.accessTransactionId}:${input.idempotencyKey}`);
    const sourceOfFunds = sourceOfFundsFromPlan(input.plan);

    const record: AccessSettlementRecord = Object.freeze({
      settlementId,
      accessTransactionId: input.plan.accessTransactionId,
      plan: input.plan,
      sourceOfFunds,
      status: 'PENDING',
      entitlementReservationId: null,
      fundingReservationId: null,
      userPaymentReference: null,
      providerPaymentReference: null,
      canonicalJournalId: null,
      refundAllocation: null,
      evidence: Object.freeze({
        ...emptyEvidence(),
        checkoutQuoteRef: input.plan.evidenceReference,
      }),
      failureCode: null,
      failureMessage: null,
      createdAt: input.now,
      updatedAt: input.now,
    });

    this.settlements.set(settlementId, record);
    this.operationIdempotency.set(idemKey, record);
    this.deps.evidence.seal({
      kind: 'SETTLEMENT_PREPARED',
      settlementId,
      accessTransactionId: input.plan.accessTransactionId,
      payload: {
        providerAmount: Number(input.plan.providerAmount),
        accessPool: Number(input.plan.accessPoolContribution),
        userContribution: Number(input.plan.userContribution),
      },
      now: input.now,
    });

    return { ok: true, settlement: record };
  }

  async reserve(input: {
    readonly settlementId: AccessDomainSettlementId;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<SettlementOperationResult<void>> {
    const current = this.settlements.get(input.settlementId);
    if (!current) {
      return {
        ok: false,
        settlement: null,
        failure: settlementFailure('INVALID_STATE', 'settlement not found'),
      };
    }

    const idemKey = this.idempotencyKey(input.settlementId, 'RESERVE', input.idempotencyKey);
    const prior = this.operationIdempotency.get(idemKey);
    if (prior) {
      return { ok: true, settlement: prior };
    }

    if (current.status !== 'PENDING' && current.status !== 'FUNDING_RESERVED') {
      if (current.entitlementReservationId && current.fundingReservationId) {
        return { ok: true, settlement: current };
      }
      return {
        ok: false,
        settlement: current,
        failure: settlementFailure('INVALID_STATE', `cannot reserve from status ${current.status}`),
      };
    }

    const { plan } = current;
    let updated = current;

    if (!current.entitlementReservationId && plan.entitlementUnits > 0n) {
      const entResult = await this.deps.solvency.getEntitlementReservations().reserve({
        entitlementId: plan.entitlementId,
        accessTransactionId: plan.accessTransactionId,
        userId: plan.userId,
        category: plan.category,
        unit: plan.unit,
        quantity: plan.entitlementUnits,
        expiresAt: plan.expiresAt,
        evidenceReference: `evidence:ent-reserve:${input.settlementId}`,
        idempotencyKey: `settle-ent:${input.idempotencyKey}`,
        now: input.now,
      });

      if (!entResult.ok) {
        if (entResult.code === 'IDEMPOTENT' && entResult.reservation) {
          updated = this.updateSettlement(updated, {
            status: updated.status === 'PENDING' ? 'FUNDING_RESERVED' : updated.status,
            entitlementReservationId: entResult.reservation.entitlementReservationId,
            evidence: {
              ...updated.evidence,
              entitlementReservationRef: accessEvidenceRefFor(
                entResult.reservation.evidenceReference,
              ),
            },
            updatedAt: input.now,
          });
        } else {
          const failed = this.updateSettlement(updated, {
            status: 'FAILED',
            failureCode: 'INSUFFICIENT_ENTITLEMENT',
            failureMessage: entResult.code,
            updatedAt: input.now,
          });
          return {
            ok: false,
            settlement: failed,
            failure: settlementFailure('INSUFFICIENT_ENTITLEMENT', entResult.code),
          };
        }
      } else {
        updated = this.updateSettlement(updated, {
          status: updated.status,
          entitlementReservationId: entResult.reservation.entitlementReservationId,
          evidence: {
            ...updated.evidence,
            entitlementReservationRef: accessEvidenceRefFor(
              entResult.reservation.evidenceReference,
            ),
          },
          updatedAt: input.now,
        });
      }
    }

    if (!updated.fundingReservationId && plan.accessPoolContribution > 0n) {
      const fundResult = await this.deps.solvency.reserveFunding({
        fundingPoolId: plan.fundingPoolId,
        accessTransactionId: plan.accessTransactionId,
        userId: plan.userId,
        currency: plan.currency,
        amountMinorUnits: plan.accessPoolContribution,
        category: plan.category,
        expiresAt: plan.expiresAt,
        evidenceReference: `evidence:fund-reserve:${input.settlementId}`,
        idempotencyKey: `settle-fund:${input.idempotencyKey}`,
        now: input.now,
      });

      if (!fundResult.ok) {
        if (fundResult.code === 'IDEMPOTENT' && fundResult.reservation) {
          updated = this.updateSettlement(updated, {
            status: 'FUNDING_RESERVED',
            fundingReservationId: fundResult.reservation.fundingReservationId,
            evidence: {
              ...updated.evidence,
              fundingReservationRef: accessEvidenceRefFor(
                fundResult.reservation.evidenceReference,
              ),
            },
            updatedAt: input.now,
          });
        } else {
          await this.safeReleaseReservations(updated, input.now, input.idempotencyKey);
          const failed = this.updateSettlement(updated, {
            status: 'FAILED',
            failureCode: 'INSUFFICIENT_FUNDING',
            failureMessage: fundResult.code,
            updatedAt: input.now,
          });
          return {
            ok: false,
            settlement: failed,
            failure: settlementFailure('INSUFFICIENT_FUNDING', fundResult.code),
          };
        }
      } else {
        updated = this.updateSettlement(updated, {
          status: 'FUNDING_RESERVED',
          fundingReservationId: fundResult.reservation.fundingReservationId,
          evidence: {
            ...updated.evidence,
            fundingReservationRef: accessEvidenceRefFor(
              fundResult.reservation.evidenceReference,
            ),
          },
          updatedAt: input.now,
        });
      }
    } else if (!updated.fundingReservationId && plan.accessPoolContribution === 0n) {
      updated = this.updateSettlement(updated, {
        status: 'FUNDING_RESERVED',
        updatedAt: input.now,
      });
    }

    if (updated.status === 'PENDING') {
      updated = this.updateSettlement(updated, {
        status: 'FUNDING_RESERVED',
        updatedAt: input.now,
      });
    }

    this.operationIdempotency.set(idemKey, updated);
    return { ok: true, settlement: updated };
  }

  async authorize(input: {
    readonly settlementId: AccessDomainSettlementId;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<SettlementOperationResult<void>> {
    const current = this.settlements.get(input.settlementId);
    if (!current) {
      return {
        ok: false,
        settlement: null,
        failure: settlementFailure('INVALID_STATE', 'settlement not found'),
      };
    }

    const idemKey = this.idempotencyKey(input.settlementId, 'AUTHORIZE', input.idempotencyKey);
    const prior = this.operationIdempotency.get(idemKey);
    if (prior) {
      return { ok: true, settlement: prior };
    }

    if (!['FUNDING_RESERVED', 'USER_AUTHORIZED', 'PROVIDER_AUTHORIZED', 'AUTHORIZED'].includes(current.status)) {
      if (current.status === 'AUTHORIZED' || current.status === 'CAPTURED') {
        return { ok: true, settlement: current };
      }
      return {
        ok: false,
        settlement: current,
        failure: settlementFailure('INVALID_STATE', `cannot authorize from status ${current.status}`),
      };
    }

    let updated = current;
    const { plan } = current;

    const compliance = await this.deps.compliance.evaluate({
      accessTransactionId: plan.accessTransactionId,
      userId: plan.userId,
      plan,
      idempotencyKey: `compliance:${input.idempotencyKey}`,
      now: input.now,
    });

    if (!compliance.approved) {
      const failed = this.updateSettlement(updated, {
        status: 'FAILED',
        failureCode: 'COMPLIANCE_REFUSED',
        failureMessage: compliance.refusalCode,
        evidence: { ...updated.evidence, complianceRef: compliance.evidenceReference },
        updatedAt: input.now,
      });
      return {
        ok: false,
        settlement: failed,
        failure: settlementFailure('COMPLIANCE_REFUSED', compliance.refusalCode),
      };
    }

    updated = this.updateSettlement(updated, {
      status: updated.status,
      evidence: { ...updated.evidence, complianceRef: compliance.evidenceReference },
      updatedAt: input.now,
    });

    if (!updated.userPaymentReference && plan.userContribution > 0n) {
      const userAuth = await this.deps.userFunding.authorize({
        userId: plan.userId,
        amountMinorUnits: plan.userContribution,
        currency: plan.currency,
        fundingSource: plan.userFundingSource,
        accessTransactionId: plan.accessTransactionId,
        settlementId: input.settlementId,
        idempotencyKey: `user-auth:${input.idempotencyKey}`,
        now: input.now,
      });

      if (!('ok' in userAuth) || !userAuth.ok) {
        if ('code' in userAuth && userAuth.code === 'UNKNOWN') {
          const recon = this.updateSettlement(updated, {
            status: 'RECONCILIATION_REQUIRED',
            failureCode: 'UNKNOWN_REMOTE_STATE',
            failureMessage: 'user authorization timed out',
            evidence: { ...updated.evidence, userAuthorizationRef: userAuth.evidenceReference },
            updatedAt: input.now,
          });
          return {
            ok: false,
            settlement: recon,
            failure: settlementFailure('RECONCILIATION_REQUIRED', 'user authorization unknown state'),
          };
        }
        await this.safeReleaseReservations(updated, input.now, input.idempotencyKey);
        const failed = this.updateSettlement(updated, {
          status: 'FAILED',
          failureCode: 'USER_AUTHORIZATION_FAILED',
          failureMessage: 'code' in userAuth ? userAuth.code : 'declined',
          evidence: {
            ...updated.evidence,
            userAuthorizationRef:
              'evidenceReference' in userAuth ? userAuth.evidenceReference : null,
          },
          updatedAt: input.now,
        });
        return {
          ok: false,
          settlement: failed,
          failure: settlementFailure('USER_AUTHORIZATION_FAILED', 'user authorization declined'),
        };
      }

      updated = this.updateSettlement(updated, {
        status: 'USER_AUTHORIZED',
        userPaymentReference: userAuth.paymentReference,
        evidence: { ...updated.evidence, userAuthorizationRef: userAuth.evidenceReference },
        updatedAt: input.now,
      });
    } else if (plan.userContribution === 0n) {
      updated = this.updateSettlement(updated, {
        status: 'USER_AUTHORIZED',
        updatedAt: input.now,
      });
    }

    if (!updated.providerPaymentReference) {
      try {
        assertRailCapability(this.deps.paymentRail, 'AUTHORIZE');
      } catch (error) {
        return {
          ok: false,
          settlement: updated,
          failure: settlementFailure(
            'RAIL_CAPABILITY_MISSING',
            error instanceof Error ? error.message : 'missing AUTHORIZE capability',
          ),
        };
      }

      const providerAuth = await this.deps.paymentRail.authorize({
        plan,
        providerPaymentMethod: plan.providerPaymentMethod,
        providerFacingAmount: plan.providerAmount,
        currency: plan.currency,
        accessTransactionId: plan.accessTransactionId,
        settlementId: input.settlementId,
        idempotencyKey: `provider-auth:${input.idempotencyKey}`,
        now: input.now,
      });

      if (!('ok' in providerAuth) || !providerAuth.ok) {
        if ('code' in providerAuth && providerAuth.code === 'UNKNOWN') {
          const recon = this.updateSettlement(updated, {
            status: 'RECONCILIATION_REQUIRED',
            failureCode: 'UNKNOWN_REMOTE_STATE',
            failureMessage: 'provider authorization timed out',
            evidence: {
              ...updated.evidence,
              providerAuthorizationRef: providerAuth.evidenceReference,
            },
            updatedAt: input.now,
          });
          return {
            ok: false,
            settlement: recon,
            failure: settlementFailure('RECONCILIATION_REQUIRED', 'provider authorization unknown state'),
          };
        }
        await this.safeReleaseReservations(updated, input.now, input.idempotencyKey);
        if (updated.userPaymentReference) {
          await this.deps.userFunding.void({
            paymentReference: updated.userPaymentReference,
            accessTransactionId: plan.accessTransactionId,
            settlementId: input.settlementId,
            idempotencyKey: `user-void:${input.idempotencyKey}`,
            now: input.now,
          });
        }
        const failed = this.updateSettlement(updated, {
          status: 'FAILED',
          failureCode: 'PROVIDER_AUTHORIZATION_FAILED',
          failureMessage: 'code' in providerAuth ? providerAuth.code : 'declined',
          evidence: {
            ...updated.evidence,
            providerAuthorizationRef:
              'evidenceReference' in providerAuth ? providerAuth.evidenceReference : null,
          },
          updatedAt: input.now,
        });
        return {
          ok: false,
          settlement: failed,
          failure: settlementFailure('PROVIDER_AUTHORIZATION_FAILED', 'provider authorization declined'),
        };
      }

      updated = this.updateSettlement(updated, {
        status: 'AUTHORIZED',
        providerPaymentReference: providerAuth.paymentReference,
        evidence: {
          ...updated.evidence,
          providerAuthorizationRef: providerAuth.evidenceReference,
        },
        updatedAt: input.now,
      });
    }

    this.operationIdempotency.set(idemKey, updated);
    return { ok: true, settlement: updated };
  }

  async capture(input: {
    readonly settlementId: AccessDomainSettlementId;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<SettlementOperationResult<void>> {
    const current = this.settlements.get(input.settlementId);
    if (!current) {
      return {
        ok: false,
        settlement: null,
        failure: settlementFailure('INVALID_STATE', 'settlement not found'),
      };
    }

    const idemKey = this.idempotencyKey(input.settlementId, 'CAPTURE', input.idempotencyKey);
    const prior = this.operationIdempotency.get(idemKey);
    if (prior) {
      return { ok: true, settlement: prior };
    }

    if (current.status !== 'AUTHORIZED' && current.status !== 'CAPTURE_PENDING') {
      if (current.status === 'CAPTURED') {
        return { ok: true, settlement: current };
      }
      return {
        ok: false,
        settlement: current,
        failure: settlementFailure('INVALID_STATE', `cannot capture from status ${current.status}`),
      };
    }

    const { plan } = current;
    let updated = this.updateSettlement(current, {
      status: 'CAPTURE_PENDING',
      updatedAt: input.now,
    });

    if (plan.userContribution > 0n && current.userPaymentReference) {
      const userCapture = await this.deps.userFunding.capture({
        paymentReference: current.userPaymentReference,
        amountMinorUnits: plan.userContribution,
        currency: plan.currency,
        accessTransactionId: plan.accessTransactionId,
        settlementId: input.settlementId,
        idempotencyKey: `user-capture:${input.idempotencyKey}`,
        now: input.now,
      });
      if (!('ok' in userCapture) || !userCapture.ok) {
        const failed = this.updateSettlement(updated, {
          status: 'FAILED',
          failureCode: 'CAPTURE_FAILED',
          failureMessage: 'user capture failed',
          updatedAt: input.now,
        });
        return {
          ok: false,
          settlement: failed,
          failure: settlementFailure('CAPTURE_FAILED', 'user capture failed'),
        };
      }
    }

    assertRailCapability(this.deps.paymentRail, 'CAPTURE');
    const providerCapture = await this.deps.paymentRail.capture({
      paymentReference: current.providerPaymentReference!,
      amountMinorUnits: plan.providerAmount,
      currency: plan.currency,
      accessTransactionId: plan.accessTransactionId,
      settlementId: input.settlementId,
      idempotencyKey: `provider-capture:${input.idempotencyKey}`,
      now: input.now,
    });

    if (!('ok' in providerCapture) || !providerCapture.ok) {
      const failed = this.updateSettlement(updated, {
        status: 'FAILED',
        failureCode: 'CAPTURE_FAILED',
        failureMessage: 'provider capture failed',
        updatedAt: input.now,
      });
      return {
        ok: false,
        settlement: failed,
        failure: settlementFailure('CAPTURE_FAILED', 'provider capture failed'),
      };
    }

    if (current.fundingReservationId) {
      await this.deps.solvency.consumeFunding({
        fundingReservationId: current.fundingReservationId,
        evidenceReference: `evidence:fund-consume:${input.settlementId}`,
        idempotencyKey: `fund-consume:${input.idempotencyKey}`,
        now: input.now,
      });
    }

    if (current.entitlementReservationId) {
      await this.deps.solvency.getEntitlementReservations().consume({
        entitlementReservationId: current.entitlementReservationId,
        evidenceReference: `evidence:ent-consume:${input.settlementId}`,
        idempotencyKey: `ent-consume:${input.idempotencyKey}`,
        now: input.now,
      });
    }

    const ledger = await this.deps.fiatLedger.postSettlementCapture({
      settlementId: input.settlementId,
      accessTransactionId: plan.accessTransactionId,
      sourceOfFunds: current.sourceOfFunds,
      providerAmount: plan.providerAmount,
      currency: plan.currency,
      providerPaymentReference: current.providerPaymentReference!,
      idempotencyKey: `ledger-capture:${input.idempotencyKey}`,
      evidenceReference: providerCapture.evidenceReference,
      now: input.now,
    });

    updated = this.updateSettlement(updated, {
      status: 'CAPTURED',
      canonicalJournalId: ledger.journalId,
      evidence: {
        ...updated.evidence,
        captureRef: providerCapture.evidenceReference,
        canonicalLedgerRef: ledger.evidenceReference,
      },
      updatedAt: input.now,
    });

    this.operationIdempotency.set(idemKey, updated);
    return { ok: true, settlement: updated };
  }

  async void(input: {
    readonly settlementId: AccessDomainSettlementId;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<SettlementOperationResult<void>> {
    const current = this.settlements.get(input.settlementId);
    if (!current) {
      return {
        ok: false,
        settlement: null,
        failure: settlementFailure('INVALID_STATE', 'settlement not found'),
      };
    }

    const idemKey = this.idempotencyKey(input.settlementId, 'VOID', input.idempotencyKey);
    const prior = this.operationIdempotency.get(idemKey);
    if (prior) {
      return { ok: true, settlement: prior };
    }

    if (current.status === 'VOIDED' || current.status === 'CAPTURED') {
      if (current.status === 'VOIDED') {
        return { ok: true, settlement: current };
      }
      return {
        ok: false,
        settlement: current,
        failure: settlementFailure('INVALID_STATE', 'cannot void captured settlement'),
      };
    }

    if (current.status === 'RECONCILIATION_REQUIRED') {
      return {
        ok: false,
        settlement: current,
        failure: settlementFailure('RECONCILIATION_REQUIRED', 'reconcile before void'),
      };
    }

    let updated = this.updateSettlement(current, {
      status: 'VOID_PENDING',
      updatedAt: input.now,
    });

    const { plan } = current;

    if (current.userPaymentReference) {
      await this.deps.userFunding.void({
        paymentReference: current.userPaymentReference,
        accessTransactionId: plan.accessTransactionId,
        settlementId: input.settlementId,
        idempotencyKey: `user-void:${input.idempotencyKey}`,
        now: input.now,
      });
    }

    if (current.providerPaymentReference) {
      assertRailCapability(this.deps.paymentRail, 'VOID');
      const voidResult = await this.deps.paymentRail.void({
        paymentReference: current.providerPaymentReference,
        accessTransactionId: plan.accessTransactionId,
        settlementId: input.settlementId,
        idempotencyKey: `provider-void:${input.idempotencyKey}`,
        now: input.now,
      });
      if ('ok' in voidResult && voidResult.ok) {
        updated = this.updateSettlement(updated, {
          status: updated.status,
          evidence: { ...updated.evidence, voidRef: voidResult.evidenceReference },
        });
      }
    }

    await this.safeReleaseReservations(updated, input.now, input.idempotencyKey);

    updated = this.updateSettlement(updated, {
      status: 'VOIDED',
      updatedAt: input.now,
    });

    this.operationIdempotency.set(idemKey, updated);
    return { ok: true, settlement: updated };
  }

  async refund(input: {
    readonly settlementId: AccessDomainSettlementId;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<SettlementOperationResult<AccessRefundAllocation>> {
    const current = this.getSettlement(input.settlementId);
    if (!current || current.status !== 'CAPTURED') {
      return {
        ok: false,
        settlement: current,
        failure: settlementFailure('INVALID_STATE', 'full refund requires CAPTURED status'),
      };
    }
    return this.partialRefund({
      settlementId: input.settlementId,
      refundAmount: current.plan.providerAmount,
      idempotencyKey: input.idempotencyKey,
      now: input.now,
    });
  }

  async partialRefund(input: {
    readonly settlementId: AccessDomainSettlementId;
    readonly refundAmount: bigint;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<SettlementOperationResult<AccessRefundAllocation>> {
    const current = this.settlements.get(input.settlementId);
    if (!current || current.status !== 'CAPTURED' && current.status !== 'PARTIALLY_REFUNDED') {
      return {
        ok: false,
        settlement: current ?? null,
        failure: settlementFailure('INVALID_STATE', 'refund requires captured settlement'),
      };
    }

    const idemKey = this.idempotencyKey(input.settlementId, 'PARTIAL_REFUND', input.idempotencyKey);
    const prior = this.operationIdempotency.get(idemKey);
    if (prior && prior.refundAllocation) {
      return { ok: true, settlement: prior, value: prior.refundAllocation };
    }

    const allocation = allocateProportionalRefund({
      totalRefundAmount: input.refundAmount,
      original: current.sourceOfFunds,
      evidenceReference: `evidence:refund-alloc:${input.idempotencyKey}`,
    });

    const { plan } = current;

    if (allocation.userRefund > 0n && current.userPaymentReference) {
      await this.deps.userFunding.refund({
        paymentReference: current.userPaymentReference,
        amountMinorUnits: allocation.userRefund,
        currency: plan.currency,
        accessTransactionId: plan.accessTransactionId,
        settlementId: input.settlementId,
        idempotencyKey: `user-refund:${input.idempotencyKey}`,
        now: input.now,
      });
    }

    if (current.providerPaymentReference) {
      assertRailCapability(this.deps.paymentRail, 'REFUND');
      await this.deps.paymentRail.refund({
        paymentReference: current.providerPaymentReference,
        amountMinorUnits: input.refundAmount,
        currency: plan.currency,
        accessTransactionId: plan.accessTransactionId,
        settlementId: input.settlementId,
        idempotencyKey: `provider-refund:${input.idempotencyKey}`,
        now: input.now,
      });
    }

    await this.deps.fiatLedger.postSettlementRefund({
      settlementId: input.settlementId,
      accessTransactionId: plan.accessTransactionId,
      refundAllocation: allocation,
      idempotencyKey: `ledger-refund:${input.idempotencyKey}`,
      evidenceReference: accessEvidenceRefFor(allocation.evidenceReference),
      now: input.now,
    });

    const isFullRefund = input.refundAmount >= plan.providerAmount;
    const updated = this.updateSettlement(current, {
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      refundAllocation: allocation,
      evidence: {
        ...current.evidence,
        refundRef: accessEvidenceRefFor(allocation.evidenceReference),
      },
      updatedAt: input.now,
    });

    this.operationIdempotency.set(idemKey, updated);
    return { ok: true, settlement: updated, value: allocation };
  }

  getSettlement(settlementId: AccessDomainSettlementId): AccessSettlementRecord | null {
    return this.settlements.get(settlementId) ?? null;
  }

  async reconcile(input: {
    readonly settlementId: AccessDomainSettlementId;
    readonly idempotencyKey: string;
    readonly now: UtcInstant;
  }): Promise<SettlementOperationResult<void>> {
    const current = this.settlements.get(input.settlementId);
    if (!current) {
      return {
        ok: false,
        settlement: null,
        failure: settlementFailure('INVALID_STATE', 'settlement not found'),
      };
    }

    if (current.status !== 'RECONCILIATION_REQUIRED') {
      return { ok: true, settlement: current };
    }

    const idemKey = this.idempotencyKey(input.settlementId, 'RECONCILE', input.idempotencyKey);
    const prior = this.operationIdempotency.get(idemKey);
    if (prior) {
      return { ok: true, settlement: prior };
    }

    const refs: string[] = [];
    if (current.userPaymentReference) {
      refs.push(current.userPaymentReference);
    }
    if (current.providerPaymentReference) {
      refs.push(current.providerPaymentReference);
    }

    let resolvedStatus: AccessSettlementOrchestrationStatus | null = null;

    for (const ref of refs) {
      assertRailCapability(this.deps.paymentRail, 'RECONCILE');
      const result = await this.deps.paymentRail.reconcile({
        paymentReference: ref,
        idempotencyKey: `reconcile:${ref}:${input.idempotencyKey}`,
        now: input.now,
      });
      if (result.remoteStatus === 'AUTHORIZED') {
        resolvedStatus = 'AUTHORIZED';
      } else if (result.remoteStatus === 'FAILED' || result.remoteStatus === 'VOIDED') {
        resolvedStatus = 'FAILED';
      }
    }

    if (!resolvedStatus) {
      return {
        ok: false,
        settlement: current,
        failure: settlementFailure('RECONCILIATION_REQUIRED', 'remote state still unknown'),
      };
    }

    const updated = this.updateSettlement(current, {
      status: resolvedStatus,
      failureCode: resolvedStatus === 'FAILED' ? 'PROVIDER_AUTHORIZATION_FAILED' : null,
      failureMessage: resolvedStatus === 'FAILED' ? 'reconciled as failed' : null,
      updatedAt: input.now,
    });

    if (resolvedStatus === 'FAILED') {
      await this.safeReleaseReservations(updated, input.now, input.idempotencyKey);
    }

    this.operationIdempotency.set(idemKey, updated);
    return { ok: true, settlement: updated };
  }

  private async safeReleaseReservations(
    settlement: AccessSettlementRecord,
    now: UtcInstant,
    idempotencyKey: string,
  ): Promise<void> {
    if (settlement.entitlementReservationId) {
      const entRes = this.deps.solvency
        .getEntitlementReservations()
        .getReservation(settlement.entitlementReservationId);
      if (entRes?.status === 'RESERVED') {
        await this.deps.solvency.getEntitlementReservations().release({
          entitlementReservationId: settlement.entitlementReservationId,
          evidenceReference: `evidence:ent-release:${settlement.settlementId}`,
          idempotencyKey: `ent-release:${idempotencyKey}`,
          now,
        });
      }
    }

    if (settlement.fundingReservationId) {
      await this.deps.solvency.releaseFunding({
        fundingReservationId: settlement.fundingReservationId,
        evidenceReference: `evidence:fund-release:${settlement.settlementId}`,
        idempotencyKey: `fund-release:${idempotencyKey}`,
        now,
      });
    }
  }
}

export function createFiatAccessSettlementOrchestrator(
  deps: FiatAccessSettlementOrchestratorDeps,
): FiatAccessSettlementOrchestrator {
  return new FiatAccessSettlementOrchestrator(deps);
}
