/**
 * End-to-end demo — Phase 1 banking simulation.
 *
 * Extends the original customer-domain walkthrough with Kernel-gated
 * account opening, deposits, a withdrawal, an internal transfer, a
 * class-segregated balance, a refused opening, and evidence-chain verify.
 *
 * Readable by a non-engineer: each step is labelled in plain language.
 */
import {
  asCurrencyCode,
  asCustomerId,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  asUtcInstant,
  createProspect,
  isErr,
  isOk,
  notStartedVerification,
  transitionCustomerStatus,
  type Customer,
  type CustomerStatus,
} from './index.ts';
import { asAccountId } from './account.ts';
import { asProductId } from './product.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { Money } from '../../money/src/money.ts';
import { createSimulationRuntime } from '../../../services/accounts/src/runtime.ts';
import {
  CAPABILITIES,
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../config/src/flags.ts';
import { balanceOfAccount, projectCustomerPosition } from '../../../services/accounts/src/balances.ts';
import { SIMULATION_FUNDING_SOURCE_ID } from '../../ledger/src/types.ts';

const occurredAt = asUtcInstant('2026-08-13T15:00:00.000Z');

function heading(step: string, title: string): void {
  console.log('');
  console.log(`======== ${step}: ${title} ========`);
}

function mustTransition(customer: Customer, to: CustomerStatus): Customer {
  const result = transitionCustomerStatus(customer, to, occurredAt);
  if (isErr(result)) {
    throw new Error(
      `demo expected legal transition ${customer.status} -> ${to}, got ${result.error.code}`,
    );
  }
  console.log(
    `  Customer ${result.value.customer.id} moved ${customer.status} → ${result.value.customer.status} (version ${result.value.customer.version})`,
  );
  return result.value.customer;
}

function main(): void {
  heading('STEP 0', 'Confirm this is a simulation — no live money');
  console.log(`  ENVIRONMENT = ${ENVIRONMENT}`);
  console.log(`  LIVE_MONEY_ENABLED = ${LIVE_MONEY_ENABLED}`);
  console.log(`  LIVE_PAYMENTS_ENABLED = ${LIVE_PAYMENTS_ENABLED}`);
  console.log(`  LIVE_BANKING_RAILS = ${LIVE_BANKING_RAILS}`);
  console.log(`  LIVE_EXTERNAL_KYC = ${LIVE_EXTERNAL_KYC}`);
  console.log(`  LIVE_EXTERNAL_BANK_CONNECTION = ${LIVE_EXTERNAL_BANK_CONNECTION}`);
  if (CAPABILITIES.LIVE_MONEY_ENABLED !== false || ENVIRONMENT !== 'simulation') {
    throw new Error('demo aborted: simulation flags must remain false');
  }

  const runtime = createSimulationRuntime();

  heading('STEP 1', 'Create a customer');
  let customer = createProspect({
    id: asCustomerId('cust_demo_001'),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    residency: asResidency('GB'),
    verification: notStartedVerification(asUtcInstant('2026-11-13T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-08-13T12:00:00.000Z'),
  });
  console.log(`  Opened prospect ${customer.id} at ${customer.legalEntityId} (${customer.jurisdiction})`);
  customer = mustTransition(customer, 'PENDING_VERIFICATION');
  customer = Object.freeze({
    ...customer,
    verification: Object.freeze({
      kycState: 'VERIFIED' as const,
      kycRecordVersion: 1,
      refreshBy: asUtcInstant('2027-08-13T00:00:00.000Z'),
    }),
  });
  customer = mustTransition(customer, 'ACTIVE');
  runtime.customers.put(customer.id, customer);
  console.log('  Customer is ACTIVE and ready to open an account.');

  heading('STEP 2', 'Open an account — the Compliance Kernel decides');
  const opened = runtime.accountsService.open({
    id: asIntentId('demo_open_demand'),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: 'demo_open_demand',
    actorId: 'demo_operator',
    requestedAt: occurredAt,
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId('acct_demo_demand'),
      ownerId: customer.id,
      productId: asProductId('prod_demand_usd_gb'),
      accountClass: 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
    },
  });
  if (opened.outcome !== 'OPENED') {
    throw new Error(`demo expected OPENED, got ${opened.outcome}`);
  }
  console.log(`  Kernel status: ${opened.decision.status}`);
  console.log(`  Account ${opened.account.id} opened as ${opened.account.accountClass}.`);
  console.log('  There is no balance stored on the account. The ledger will be the source.');
  console.log(`  Execution Authority id: ${opened.decision.executionAuthority?.authorityId}`);

  const savings = runtime.accountsService.open({
    id: asIntentId('demo_open_savings'),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: 'demo_open_savings',
    actorId: 'demo_operator',
    requestedAt: occurredAt,
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId('acct_demo_savings'),
      ownerId: customer.id,
      productId: asProductId('prod_savings_usd_gb'),
      accountClass: 'SAVINGS_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
    },
  });
  if (savings.outcome !== 'OPENED') {
    throw new Error('demo expected savings OPENED');
  }
  console.log(`  Second account ${savings.account.id} opened as ${savings.account.accountClass}.`);

  heading('STEP 3', 'Two deposits (simulated funding source, not a corporate account)');
  const deposit1 = runtime.money.deposit({
    id: asIntentId('demo_dep_1'),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: 'demo_dep_1',
    actorId: 'demo_operator',
    requestedAt: occurredAt,
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(10_000n, 'USD') },
  });
  const deposit2 = runtime.money.deposit({
    id: asIntentId('demo_dep_2'),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: 'demo_dep_2',
    actorId: 'demo_operator',
    requestedAt: occurredAt,
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(5_000n, 'USD') },
  });
  if (deposit1.outcome !== 'POSTED' || deposit2.outcome !== 'POSTED') {
    throw new Error('demo expected deposits POSTED');
  }
  for (const journal of [deposit1.journal, deposit2.journal]) {
    console.log(`  Journal ${journal.id}`);
    for (const posting of journal.postings) {
      console.log(
        `    ${posting.direction.padEnd(6)} ${posting.accountId}  ${posting.amount.minorUnits.toString()} ${posting.amount.currency}`,
      );
    }
    console.log(`    contra = ${SIMULATION_FUNDING_SOURCE_ID} (named simulation source; not corporate)`);
  }
  console.log(`  Growth attribution entries: ${runtime.growth.count()} (principal is not growth)`);

  heading('STEP 4', 'A withdrawal');
  const withdrawal = runtime.money.withdraw({
    id: asIntentId('demo_wd_1'),
    actionType: ACTION_TYPES.POST_WITHDRAWAL,
    idempotencyKey: 'demo_wd_1',
    actorId: 'demo_operator',
    requestedAt: occurredAt,
    purpose: 'CUSTOMER_WITHDRAWAL',
    payload: { accountId: opened.account.id, amount: Money.fromMinorUnits(2_000n, 'USD') },
  });
  if (withdrawal.outcome !== 'POSTED') {
    throw new Error('demo expected withdrawal POSTED');
  }
  for (const posting of withdrawal.journal.postings) {
    console.log(
      `    ${posting.direction.padEnd(6)} ${posting.accountId}  ${posting.amount.minorUnits.toString()} ${posting.amount.currency}`,
    );
  }

  heading('STEP 5', 'An internal transfer (demand deposit → savings, via named class bridge)');
  const transfer = runtime.money.transfer({
    id: asIntentId('demo_xfer_1'),
    actionType: ACTION_TYPES.INTERNAL_TRANSFER,
    idempotencyKey: 'demo_xfer_1',
    actorId: 'demo_operator',
    requestedAt: occurredAt,
    purpose: 'CUSTOMER_TRANSFER',
    payload: {
      sourceAccountId: opened.account.id,
      destinationAccountId: savings.account.id,
      amount: Money.fromMinorUnits(3_000n, 'USD'),
    },
  });
  if (transfer.outcome !== 'POSTED') {
    throw new Error(`demo expected transfer POSTED, got ${transfer.outcome}`);
  }
  console.log(`  Class bridge: ${transfer.journal.classBridgeName}`);
  for (const posting of transfer.journal.postings) {
    console.log(
      `    ${posting.direction.padEnd(6)} ${posting.accountId}  ${posting.amount.minorUnits.toString()} ${posting.amount.currency}`,
    );
  }

  heading('STEP 6', 'Class-segregated balance breakdown');
  const demandBal = balanceOfAccount(runtime.ledger, opened.account);
  const savingsBal = balanceOfAccount(runtime.ledger, savings.account);
  if (!isOk(demandBal) || !isOk(savingsBal)) {
    throw new Error('demo expected readable balances');
  }
  console.log(`  Demand-deposit account: ${demandBal.value.minorUnits.toString()} USD minor units`);
  console.log(`  Savings-deposit account: ${savingsBal.value.minorUnits.toString()} USD minor units`);
  const position = projectCustomerPosition(
    runtime.ledger,
    customer.id,
    runtime.accountsService.listAccounts(),
  );
  if (!isOk(position)) {
    throw new Error('demo expected a customer position');
  }
  const b = position.value.breakdown;
  console.log('  Position (one object — total cannot appear without the breakdown):');
  console.log(`    deposits        ${b.deposits.total.minorUnits.toString()}  insured/${b.deposits.classification.realization}`);
  console.log(`    investments     ${b.investments.total.minorUnits.toString()}  ${b.investments.classification.insurance}`);
  console.log(`    digital_assets  ${b.digital_assets.total.minorUnits.toString()}  ${b.digital_assets.classification.insurance}`);
  console.log(`    rewards         ${b.rewards.total.minorUnits.toString()}  ${b.rewards.classification.insurance}`);
  console.log(`    pending         ${b.pending.total.minorUnits.toString()}  ${b.pending.classification.realization}`);
  console.log(`    grand total     ${position.value.grandTotal.minorUnits.toString()} USD minor units`);
  console.log('  No percentage-return, yield, or growth-rate field exists on this object.');

  heading('STEP 7', 'One REFUSED account opening — evidence sealed, no account created');
  const prospect = createProspect({
    id: asCustomerId('cust_demo_refused'),
    legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
    jurisdiction: asJurisdiction('GB'),
    residency: asResidency('GB'),
    verification: notStartedVerification(asUtcInstant('2026-11-13T00:00:00.000Z')),
    createdAt: asUtcInstant('2026-08-13T12:00:00.000Z'),
  });
  runtime.customers.put(prospect.id, prospect);
  const beforeCount = runtime.accountsService.listAccounts().length;
  const refused = runtime.accountsService.open({
    id: asIntentId('demo_open_refused'),
    actionType: ACTION_TYPES.OPEN_ACCOUNT,
    idempotencyKey: 'demo_open_refused',
    actorId: 'demo_operator',
    requestedAt: occurredAt,
    purpose: 'CUSTOMER_ONBOARDING',
    payload: {
      accountId: asAccountId('acct_demo_refused'),
      ownerId: prospect.id,
      productId: asProductId('prod_demand_usd_gb'),
      accountClass: 'DEMAND_DEPOSIT',
      legalEntityId: asLegalEntityId('le_solstice_uk_ltd'),
      jurisdiction: asJurisdiction('GB'),
      currency: asCurrencyCode('USD'),
    },
  });
  console.log(`  Kernel status: ${refused.outcome === 'KERNEL_REFUSED' ? refused.decision.status : refused.outcome}`);
  console.log(`  Accounts before: ${beforeCount}; after: ${runtime.accountsService.listAccounts().length}`);
  if (refused.outcome !== 'KERNEL_REFUSED' || runtime.accountsService.listAccounts().length !== beforeCount) {
    throw new Error('demo expected a refused opening with no new account');
  }

  heading('STEP 8', 'Print every evidence record');
  for (const record of runtime.evidence.list()) {
    console.log(
      `  seq=${record.seq} kind=${record.kind} sha256=${record.recordSha256.slice(0, 16)}… prev=${record.prevRecordSha256.slice(0, 8)}…`,
    );
  }

  heading('STEP 9', 'Verify the evidence hash chain end to end');
  const chain = runtime.evidence.verifyChain();
  console.log(`  verified=${chain.ok} records=${chain.length}`);

  heading('STEP 10', 'Confirm the books still balance');
  for (const [asset, totals] of runtime.ledger.totalsByAsset()) {
    console.log(`  ${asset} debits=${totals.debits.toString()} credits=${totals.credits.toString()}`);
    if (totals.debits !== totals.credits) {
      throw new Error(`books do not balance for ${asset}`);
    }
  }

  const illegal = transitionCustomerStatus(customer, 'CLOSED', occurredAt);
  if (isOk(illegal)) {
    const closed = illegal.value.customer;
    const reopen = transitionCustomerStatus(closed, 'ACTIVE', occurredAt);
    if (!isOk(reopen) && reopen.error.code === 'ILLEGAL_CUSTOMER_STATUS_TRANSITION') {
      console.log('');
      console.log('  (Customer domain still rejects CLOSED → ACTIVE as a typed value.)');
    }
  }

  console.log('');
  console.log('demo: ok');
}

main();
