import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { staffOperatorFromRoles, type StaffOperator } from '../../../identity/src/staff/operator.ts';
import { MemoryOperationsControlStore } from '../../../persistence/src/operations-control/memory-store.ts';
import { OperationsControlPlane } from './service.ts';
import { OPERATIONS_CONTROL_FLAGS } from './flags.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

function plane() {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const events: Array<{ eventType: string }> = [];
  return {
    clock,
    evidence,
    events,
    plane: new OperationsControlPlane({
      clock,
      evidence,
      events: { record(event) { events.push({ eventType: event.eventType }); } },
    }),
  };
}

function staff(role: StaffOperator['roles'][number], id: string, stepUp = true): StaffOperator {
  return staffOperatorFromRoles({
    operatorId: id,
    identityId: `id_${id}`,
    roles: [role],
    assurance: stepUp ? 'STRONG' : 'STANDARD',
    stepUpSatisfied: stepUp,
    sessionId: `sess_${id}`,
  });
}

describe('operations control plane', () => {
  it('keeps production disabled and refuses ledger, EA, and custody keys', () => {
    const { plane: ops } = plane();
    assert.equal(ops.flags.PRODUCTION_READY, false);
    assert.equal(ops.flags.PRODUCTION_ACTIVE, false);
    assert.equal(ops.flags.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(OPERATIONS_CONTROL_FLAGS.staffCanPostJournal, false);
    assert.throws(() => ops.refuseStaffLedgerWrite(), /cannot post a ledger journal/);
    assert.throws(() => ops.refuseStaffAuthorityIssue(), /cannot issue Execution Authority/);
    assert.throws(() => ops.refuseStaffCustodyKeyAccess(), /cannot access custody private keys/);
  });

  it('enforces least privilege and cross-role denial', () => {
    const { plane: ops } = plane();
    const support = staff('CUSTOMER_SUPPORT', 'support_1');
    const denied = ops.createCase({
      operator: support,
      domain: 'SANCTIONS',
      type: 'SANCTIONS_HIT',
      subject: 'cust_1',
      severity: 'HIGH',
      source: 'PROVIDER',
      reason: 'open sanctions review',
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'ROLE_DENIED');
    }
    const created = ops.createCase({
      operator: support,
      domain: 'CUSTOMER_SUPPORT',
      type: 'SUPPORT',
      subject: 'cust_1',
      severity: 'LOW',
      source: 'CUSTOMER',
      reason: 'customer cannot see a payment',
    });
    assert.equal(created.ok, true);
    const restrict = ops.privilegedAction({
      operator: support,
      action: 'ACCOUNT_RESTRICT',
      reason: 'support trying to restrict',
      subjectRef: 'acct_1',
      secondApprover: staff('COMPLIANCE_MANAGER', 'mgr_1'),
    });
    assert.equal(restrict.ok, false);
    if (!restrict.ok) {
      assert.equal(restrict.error.code, 'ROLE_DENIED');
    }
    const auditor = staff('AUDITOR', 'aud_1');
    const auditCreate = ops.createCase({
      operator: auditor,
      domain: 'PAYMENT',
      type: 'PAYMENT_EXCEPTION',
      subject: 'pay_1',
      severity: 'MEDIUM',
      source: 'SYSTEM',
      reason: 'auditor must be read-only',
    });
    assert.equal(auditCreate.ok, false);
  });

  it('creates, assigns, and transitions a persistent case', () => {
    const { plane: ops } = plane();
    const analyst = staff('COMPLIANCE_ANALYST', 'analyst_1');
    const opened = ops.createCase({
      operator: analyst,
      domain: 'AML',
      type: 'AML_ALERT',
      subject: 'cust_aml',
      severity: 'HIGH',
      source: 'SYSTEM',
      reason: 'transaction monitoring alert',
    });
    assert.equal(opened.ok, true);
    if (!opened.ok) throw new Error('expected case');
    assert.equal(opened.value.status, 'OPEN');
    assert.ok(opened.value.specializedCaseId);
    const assigned = ops.assignCase(analyst, opened.value.caseId, analyst.operatorId, 'take ownership');
    assert.equal(assigned.ok, true);
    if (!assigned.ok) throw new Error('expected assign');
    assert.equal(assigned.value.status, 'QUEUED');
    const reviewed = ops.transitionCase(analyst, opened.value.caseId, 'IN_REVIEW', 'start review');
    assert.equal(reviewed.ok, true);
    if (!reviewed.ok) throw new Error('expected transition');
    assert.equal(reviewed.value.status, 'IN_REVIEW');
  });

  it('blocks investigator self-approval on an escalated case and requires dual control', () => {
    const { plane: ops } = plane();
    const analyst = staff('COMPLIANCE_ANALYST', 'analyst_2');
    const manager = staff('COMPLIANCE_MANAGER', 'manager_1');
    const opened = ops.createCase({
      operator: analyst,
      domain: 'SANCTIONS',
      type: 'SANCTIONS_REVIEW',
      subject: 'cust_sanctions',
      severity: 'CRITICAL',
      source: 'PROVIDER',
      reason: 'possible sanctions match',
    });
    if (!opened.ok) throw new Error('expected case');
    const assigned = ops.assignCase(analyst, opened.value.caseId, analyst.operatorId, 'investigate');
    if (!assigned.ok) throw new Error('expected assign');
    const escalated = ops.transitionCase(analyst, opened.value.caseId, 'ESCALATED', 'needs manager');
    assert.equal(escalated.ok, true);
    const self = ops.resolveCase(analyst, opened.value.caseId, 'clear my own case', 'CLEAR');
    assert.equal(self.ok, false);
    if (!self.ok) {
      assert.ok(
        self.error.code === 'SELF_APPROVAL_FORBIDDEN' ||
          self.error.code === 'DUAL_CONTROL_REQUIRED' ||
          self.error.code === 'ROLE_DENIED' ||
          self.error.code === 'CAPABILITY_DENIED',
      );
    }
    const approved = ops.resolveCase(manager, opened.value.caseId, 'manager clearance', 'CLEAR');
    assert.equal(approved.ok, false);
    if (!approved.ok) {
      assert.equal(approved.error.code, 'DUAL_CONTROL_REQUIRED');
    }
    const managerPeer = staff('COMPLIANCE_MANAGER', 'manager_2');
    const cleared = ops.resolveCase(managerPeer, opened.value.caseId, 'independent clearance', 'CLEAR', manager);
    assert.equal(cleared.ok, true);
    if (!cleared.ok) throw new Error('expected dual control resolve');
    assert.equal(cleared.value.status, 'RESOLVED');
  });

  it('requires operator step-up for privileged mutations', () => {
    const { plane: ops } = plane();
    const weak = staff('SECURITY_OPERATOR', 'sec_weak', false);
    const strong = staff('COMPLIANCE_MANAGER', 'mgr_step');
    const denied = ops.privilegedAction({
      operator: weak,
      action: 'ACCOUNT_RESTRICT',
      reason: 'fraud hold',
      subjectRef: 'acct_risk',
      secondApprover: strong,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'STEP_UP_REQUIRED');
    }
  });

  it('exposes payment, treasury, and reconciliation operations without ledger edits', () => {
    const { plane: ops, clock } = plane();
    ops.seedReadModels({
      payments: [
        {
          paymentId: 'pay_1',
          customerId: 'cust_1',
          status: 'FAILED',
          exceptionClass: 'PROVIDER_REJECTION',
          providerStatus: 'UNKNOWN',
          returnRef: null,
          reversalRef: null,
          beneficiaryReview: true,
          providerMismatch: true,
          amountMinor: '1000',
          currency: 'USD',
          updatedAt: clock.now(),
          ledgerEditableByStaff: false,
        },
      ],
      treasury: [
        {
          providerId: 'rail_1',
          providerBalanceMinor: '50000',
          currency: 'USD',
          settlementStatus: 'PENDING',
          liquidityMinor: '40000',
          isCustomerLedgerBalance: false,
          updatedAt: clock.now(),
        },
      ],
      breaks: [
        {
          breakId: 'brk_1',
          runId: 'run_1',
          domain: 'PAYMENTS',
          status: 'OPEN',
          severity: 'HIGH',
          amountMinor: '250',
          currency: 'USD',
          agedHours: 26,
          suspense: true,
          dailyCloseId: 'close_1',
          owner: null,
          updatedAt: clock.now(),
          silentOverwriteForbidden: true,
        },
      ],
    });
    assert.equal(ops.paymentOps()[0]?.ledgerEditableByStaff, false);
    assert.equal(ops.treasuryOps()[0]?.isCustomerLedgerBalance, false);
    const recon = staff('RECONCILIATION_OPERATOR', 'recon_1');
    const treasury = staff('TREASURY_OPERATOR', 'treas_1');
    const reclass = ops.privilegedAction({
      operator: recon,
      action: 'BREAK_RECLASSIFY',
      reason: 'timing difference after provider report',
      subjectRef: 'brk_1',
    });
    assert.equal(reclass.ok, true);
    assert.equal(ops.reconciliationOps()[0]?.status, 'INVESTIGATING');
    assert.equal(ops.reconciliationOps()[0]?.silentOverwriteForbidden, true);
    assert.ok(treasury);
  });

  it('exposes surveillance and custody views without guilt or keys', () => {
    const { plane: ops, clock } = plane();
    ops.seedReadModels({
      surveillance: [
        {
          alertId: 'al_1',
          kind: 'WASH_TRADE',
          marketId: 'SUNREY/MOONREY',
          subjectRefs: ['acct_a', 'acct_b'],
          legalGuilt: false,
          restrictionProposed: true,
          restrictionApplied: false,
          createdAt: clock.now(),
        },
      ],
      custody: [
        {
          walletId: 'wal_1',
          status: 'ACTIVE',
          pendingDeposits: 1,
          pendingWithdrawals: 1,
          failedWithdrawals: 1,
          providerStatus: 'HEALTHY',
          chainTxRef: 'tx_1',
          travelRuleState: 'PENDING',
          analyticsRiskState: 'ELEVATED',
          reconciliationBreaks: 1,
          privateKeyMaterial: null,
          updatedAt: clock.now(),
        },
      ],
    });
    const opened = ops.createCase({
      operator: staff('EXCHANGE_SURVEILLANCE', 'surv_1'),
      domain: 'EXCHANGE_SURVEILLANCE',
      type: 'WASH_TRADE',
      subject: 'acct_a',
      severity: 'HIGH',
      source: 'SURVEILLANCE',
      reason: 'wash-trade candidate, not guilt',
    });
    assert.equal(opened.ok, true);
    assert.equal(ops.surveillanceOps()[0]?.legalGuilt, false);
    assert.equal(ops.custodyOps()[0]?.privateKeyMaterial, null);
  });

  it('disables a provider through dual control and never returns credentials', () => {
    const { plane: ops, clock } = plane();
    ops.seedReadModels({
      providers: [
        {
          providerId: 'prov_1',
          environment: 'SANDBOX',
          lifecycle: 'SANDBOX',
          health: 'DEGRADED',
          circuitBreaker: 'OPEN',
          certification: false,
          capabilities: ['PAYMENTS'],
          credentialReferenceStatus: 'PRESENT',
          webhookHealth: 'FAILING',
          lastError: 'timeout',
          killSwitch: false,
          rawCredential: null,
          productionAuthorized: false,
          updatedAt: clock.now(),
        },
      ],
    });
    const sre = staff('SRE_OPERATOR', 'sre_1');
    const security = staff('SECURITY_OPERATOR', 'sec_1');
    const pending = ops.privilegedAction({
      operator: sre,
      action: 'PROVIDER_DISABLE',
      reason: 'repeated webhook failures',
      subjectRef: 'prov_1',
    });
    assert.equal(pending.ok, false);
    const disabled = ops.privilegedAction({
      operator: sre,
      action: 'PROVIDER_DISABLE',
      reason: 'repeated webhook failures',
      subjectRef: 'prov_1',
      secondApprover: security,
    });
    assert.equal(disabled.ok, true);
    assert.equal(ops.providerOps()[0]?.killSwitch, true);
    assert.equal(ops.providerOps()[0]?.rawCredential, null);
    assert.equal(ops.providerOps()[0]?.productionAuthorized, false);
  });

  it('records Agent and security escalations without letting staff rewrite Agent evidence', () => {
    const { plane: ops, clock } = plane();
    ops.seedReadModels({
      agents: [
        {
          agentId: 'agent_1',
          available: true,
          modelProviderStatus: 'DEGRADED',
          toolFailures: 3,
          policyBlocks: 2,
          financialEscalations: 1,
          supportEscalations: 1,
          abusePatterns: ['REPEATED_POLICY_BLOCK'],
          evidenceMutableByStaff: false,
          updatedAt: clock.now(),
        },
      ],
      security: [
        {
          eventId: 'sec_1',
          kind: 'SUSPICIOUS_AUTHENTICATION',
          subjectRef: 'cust_1',
          sessionRisk: 'ELEVATED',
          privileged: true,
          providerAuthFailure: true,
          repeatedDenial: true,
          incidentId: 'inc_1',
          rawSecret: null,
          occurredAt: clock.now(),
        },
      ],
    });
    const security = staff('SECURITY_OPERATOR', 'sec_2');
    const securityPeer = staff('SECURITY_OPERATOR', 'sec_peer');
    const opened = ops.createCase({
      operator: security,
      domain: 'AGENT',
      type: 'FINANCIAL_ESCALATION',
      subject: 'agent_1',
      severity: 'HIGH',
      source: 'AGENT',
      reason: 'financial-action escalation',
    });
    assert.equal(opened.ok, true);
    const paused = ops.privilegedAction({
      operator: security,
      action: 'AGENT_PAUSE',
      reason: 'abuse pattern',
      subjectRef: 'agent_1',
      secondApprover: securityPeer,
    });
    assert.equal(paused.ok, true);
    assert.equal(ops.agentOps()[0]?.available, false);
    assert.equal(ops.agentOps()[0]?.evidenceMutableByStaff, false);
    assert.equal(ops.securityOps()[0]?.rawSecret, null);
  });

  it('opens a privacy-controlled support view that cannot approve financial actions', () => {
    const { plane: ops } = plane();
    const support = staff('CUSTOMER_SUPPORT', 'support_2');
    const view = ops.openSupportView(support, 'cust_support', 'customer asked about payment status', false);
    assert.equal(view.ok, true);
    if (!view.ok) throw new Error('expected support view');
    assert.equal(view.value.session.readLimited, true);
    assert.equal(view.value.session.canApproveFinancialActions, false);
    assert.equal(view.value.profile.sensitiveKycVisible, false);
    assert.equal(view.value.profile.balancesVisible, false);
    const sensitive = ops.openSupportView(support, 'cust_support', 'need kyc', true);
    assert.equal(sensitive.ok, false);
  });

  it('audits privileged actions and survives restart', () => {
    const first = plane();
    const analyst = staff('COMPLIANCE_ANALYST', 'analyst_persist');
    const opened = first.plane.createCase({
      operator: analyst,
      domain: 'FRAUD',
      type: 'FRAUD_ALERT',
      subject: 'cust_persist',
      severity: 'HIGH',
      source: 'SYSTEM',
      reason: 'device risk review',
    });
    assert.equal(opened.ok, true);
    const durable = new MemoryOperationsControlStore();
    durable.import(first.plane.exportSnapshot());
    const second = plane();
    second.plane.importSnapshot(durable.export());
    assert.equal(second.plane.exportSnapshot().cases.length, 1);
    assert.ok(second.plane.exportSnapshot().actions.length >= 1);
    assert.ok(first.evidence.list().some((row) => row.kind === 'OPERATIONS_OPERATOR_ACTION'));
    assert.ok(first.events.some((row) => row.eventType === 'OperationsCaseCreated'));
  });

  it('searches only by controlled identifiers', () => {
    const { plane: ops } = plane();
    const payments = staff('PAYMENTS_OPERATOR', 'payops_1');
    const opened = ops.createCase({
      operator: payments,
      domain: 'PAYMENT',
      type: 'PAYMENT_EXCEPTION',
      subject: 'cust_pay',
      severity: 'MEDIUM',
      source: 'SYSTEM',
      reason: 'unknown provider status',
      references: [{ kind: 'payment', id: 'pay_99' }],
    });
    assert.equal(opened.ok, true);
    const empty = ops.search(payments, {});
    assert.equal(empty.ok, false);
    const found = ops.search(payments, { paymentId: 'pay_99' });
    assert.equal(found.ok, true);
    if (!found.ok) throw new Error('expected search');
    assert.equal(found.value.length, 1);
  });

  it('platform admin cannot authorize production or inherit every role', () => {
    const admin = staff('PLATFORM_ADMIN', 'admin_1');
    assert.deepEqual([...admin.roles], ['PLATFORM_ADMIN']);
    assert.equal(admin.capabilities.includes('ADMIN_COMPLIANCE_APPROVE'), false);
    const { plane: ops } = plane();
    const halt = ops.privilegedAction({
      operator: admin,
      action: 'MARKET_HALT',
      reason: 'admin trying to halt',
      subjectRef: 'SUNREY/MOONREY',
      secondApprover: staff('SECURITY_OPERATOR', 'sec_3'),
    });
    assert.equal(halt.ok, false);
  });
});
