import { Client } from 'pg';

import { DATABASES, type PersistenceEnv } from '../env.ts';
import { logPersistenceEvent } from '../logging.ts';

async function bootstrapClient(env: PersistenceEnv, database = 'postgres'): Promise<Client> {
  const client = new Client({
    host: env.host,
    port: env.port,
    user: env.bootstrapUser,
    password: env.bootstrapPassword,
    database,
  });
  await client.connect();
  return client;
}

async function roleExists(client: Client, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists',
    [name],
  );
  return result.rows[0]?.exists === true;
}

async function databaseExists(client: Client, name: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
    [name],
  );
  return result.rows[0]?.exists === true;
}

async function ensureRole(client: Client, name: string, password: string): Promise<void> {
  if (await roleExists(client, name)) {
    return;
  }
  await client.query(`CREATE ROLE ${name} LOGIN PASSWORD '${password.replaceAll("'", "''")}'`);
}

async function waitForPostgres(env: PersistenceEnv): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const client = await bootstrapClient(env);
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  logPersistenceEvent({
    level: 'error',
    code: 'POSTGRES_UNREACHABLE',
    domain: 'bootstrap',
    message: 'bootstrap role could not connect to PostgreSQL',
  });
  throw lastError instanceof Error ? lastError : new Error('PostgreSQL is unreachable');
}

/**
 * Empty application tables while leaving schema_migration in place.
 * Used by integration tests so each case starts from applied migrations
 * and no leftover financial rows. Not a production wipe tool.
 */
export async function resetPersistedData(env: PersistenceEnv): Promise<void> {
  const statements: Array<{ database: string; sql: string }> = [
    {
      database: DATABASES.customer,
      sql: `TRUNCATE TABLE
              compliance.human_decision,
              compliance.case_record,
              compliance.alert,
              compliance.fraud_result,
              compliance.aml_profile,
              compliance.velocity_counter,
              compliance.screening_result,
              compliance.provider_health,
              compliance.counterparty_fact,
              customer.manual_review_case,
              customer.policy_rule,
              customer.policy_version,
              customer.policy_product_binding,
              customer.legal_entity_capability,
              customer.policy_source,
              customer.policy_pack,
              identity.recovery_request,
              identity.capability_grant,
              identity.kyc_record,
              identity.device,
              identity.session,
              identity.webauthn_credential,
              identity.business_identity,
              identity.customer_link,
              identity.person_identity,
              payments.rail_reconciliation,
              payments.inbound_rail_payment,
              payments.rail_return,
              payments.settlement_report,
              payments.provider_health,
              payments.provider_callback,
              payments.rail_status_history,
              payments.rail_submission,
              payments.reconciliation,
              payments.payment_order,
              payments.fx_quote,
              payments.beneficiary,
              cards.acceptance_reconciliation,
              cards.acceptance_callback,
              cards.merchant_payment,
              cards.acceptance_session,
              cards.acceptance_device,
              cards.merchant_acceptance,
              cards.wallet_callback,
              cards.wallet_provisioning_attempt,
              cards.device_payment_token,
              cards.processor_callback,
              cards.network_token,
              cards.card_dispute,
              cards.card_refund,
              cards.card_clearing,
              cards.card_authorization,
              cards.card,
              cards.card_program,
              treasury.reconciliation,
              treasury.forecast,
              treasury.rebalance_proposal,
              treasury.fx_inventory,
              treasury.settlement_exposure,
              treasury.concentration_snapshot,
              treasury.route_decision,
              treasury.kill_switch,
              treasury.reservation,
              treasury.position,
              treasury.account,
              economic_graph.processed_event,
              economic_graph.snapshot,
              economic_graph.opportunity,
              economic_graph.activity,
              economic_graph.fact,
              economic_graph.edge,
              economic_graph.node,
              economic_graph.graph,
              growth.invalidation,
              growth.feasibility,
              growth.candidate,
              growth.plan,
              growth.cycle,
              growth.mandate_confirmation,
              growth.mandate_version,
              peve.data_contribution,
              peve.model_comparison,
              peve.counterfactual_baseline,
              peve.attribution_group,
              peve.attribution_entry,
              peve.dimension_result,
              peve.snapshot,
              peve.formula_version,
              customer.customer,
              customer.legal_entity
            RESTART IDENTITY CASCADE`,
    },
    {
      database: DATABASES.ledger,
      sql: `TRUNCATE TABLE
              ledger.funds_hold,
              ledger.pending_settlement,
              ledger.fee_assessment,
              ledger.reversal_record,
              ledger.interest_accrual,
              ledger.customer_statement,
              ledger.reconciliation_item,
              ledger.account_coordinate,
              ledger.product_metadata,
              ledger.dead_letter,
              ledger.inbox,
              ledger.outbox,
              ledger.posting,
              ledger.journal,
              ledger.action_intent,
              ledger.execution_authority_record,
              ledger.account_open_outcome,
              ledger.domain_event,
              ledger.account,
              ledger.ledger_account,
              ledger.product
            RESTART IDENTITY CASCADE`,
    },
    {
      database: DATABASES.evidence,
      sql: 'TRUNCATE TABLE evidence.evidence_record',
    },
    {
      database: DATABASES.security,
      sql: 'TRUNCATE TABLE security.key_metadata, security.service_identity',
    },
  ];
  for (const statement of statements) {
    const client = await bootstrapClient(env, statement.database);
    try {
      await client.query(statement.sql);
    } finally {
      await client.end();
    }
  }
  logPersistenceEvent({
    level: 'info',
    code: 'PERSISTED_DATA_RESET',
    domain: 'bootstrap',
    message: 'truncated application tables; schema_migration retained',
  });
}

/**
 * Create the four bounded-domain databases and runtime roles.
 * Idempotent. Uses the local/simulated bootstrap role only.
 */
export async function bootstrapPersistence(env: PersistenceEnv): Promise<void> {
  await waitForPostgres(env);
  const client = await bootstrapClient(env);
  try {
    await ensureRole(client, env.migratorUser, env.migratorPassword);
    await ensureRole(client, env.customerUser, env.customerPassword);
    await ensureRole(client, env.ledgerUser, env.ledgerPassword);
    await ensureRole(client, 'ledger_reader', env.ledgerPassword);
    await ensureRole(client, env.evidenceUser, env.evidencePassword);
    await ensureRole(client, env.securityUser, env.securityPassword);

    for (const database of Object.values(DATABASES)) {
      if (!(await databaseExists(client, database))) {
        await client.query(`CREATE DATABASE ${database} OWNER ${env.migratorUser}`);
        logPersistenceEvent({
          level: 'info',
          code: 'DATABASE_CREATED',
          domain: 'bootstrap',
          message: `created bounded-domain database ${database}`,
        });
      }
    }
  } finally {
    await client.end();
  }

  for (const [domain, database] of Object.entries(DATABASES) as Array<
    [keyof typeof DATABASES, string]
  >) {
    const db = await bootstrapClient(env, database);
    try {
      await db.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC`);
      await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.migratorUser}`);
      if (domain === 'customer') {
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.customerUser}`);
      } else if (domain === 'ledger') {
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.ledgerUser}`);
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ledger_reader`);
      } else if (domain === 'evidence') {
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.evidenceUser}`);
      } else {
        await db.query(`GRANT CONNECT ON DATABASE ${database} TO ${env.securityUser}`);
      }
      await db.query(`GRANT CREATE ON SCHEMA public TO ${env.migratorUser}`);
    } finally {
      await db.end();
    }
  }
}
