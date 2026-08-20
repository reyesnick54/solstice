/**
 * Chunk 161 operating-scope demo.
 *
 * Uses FICTIONAL / TEST jurisdictions only. Prints the required
 * safety flags. Does not activate production.
 */

import { FIXTURE_CORRIDOR_XA_XB } from './corridors.ts';
import { evaluateOperatingScope, toOperatingScopeFact } from './evaluation.ts';
import {
  defaultOperatingScopeCatalog,
  fixtureExternalLicense,
  queryXa,
  withEvidence,
} from './fixtures.ts';
import { FIXTURE_JURISDICTION_XA } from './jurisdictions.ts';
import { FIXTURE_ENTITY_XA } from './products.ts';
import { buildOperatingScopeReport, formatOperatingScopeReport } from './report.ts';
import type { OperatingScopeEvaluation } from './types.ts';
import {
  AI_CAN_APPROVE_JURISDICTION,
  ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL,
  EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE,
  PRODUCTION_ACTIVE,
  SUNREY_SCOPE_EQUALS_MOONREY_SCOPE,
  UNKNOWN_JURISDICTION_ENABLED,
} from './types.ts';

export function runOperatingScopeDemo(): void {
  const base = defaultOperatingScopeCatalog();
  const corridorQuery = queryXa('PAYMENT_RAILS', { corridorId: FIXTURE_CORRIDOR_XA_XB, currency: 'USD' });

  const initial = evaluateOperatingScope(corridorQuery, base);
  const withRefs = evaluateOperatingScope(
    corridorQuery,
    withEvidence(base, [
      fixtureExternalLicense('PAYMENT_RAILS'),
      fixtureExternalLicense('FIAT_BANKING'),
    ]),
  );

  const domains = [
    'SUNREY_COIN_NATIVE_ASSET',
    'MOONREY_COIN_NATIVE_ASSET',
    'SUNREY_EXCHANGE',
    'INSTITUTIONAL_CUSTODY',
    'PAYMENT_RAILS',
    'HUMAN_INFORMATION_MARKET',
  ] as const;
  const rows: OperatingScopeEvaluation[] = [initial, withRefs];
  for (const domain of domains) {
    rows.push(evaluateOperatingScope(queryXa(domain), base));
  }

  const report = buildOperatingScopeReport(rows);
  process.stdout.write(formatOperatingScopeReport(report));
  process.stdout.write(
    [
      `corridor_initial_status=${initial.status}`,
      `corridor_after_fixture_evidence=${withRefs.status}`,
      `human_approval_required=${String(withRefs.reasonCodes.includes('HUMAN_APPROVAL_REQUIRED') || withRefs.status === 'HUMAN_APPROVAL_REQUIRED')}`,
      `kernel_fact_reason_codes=${toOperatingScopeFact(withRefs).reasonCodes.join('|')}`,
      `legal_entity_ref=${FIXTURE_ENTITY_XA}`,
      `jurisdiction=${FIXTURE_JURISDICTION_XA}`,
      `UNKNOWN_JURISDICTION_ENABLED=${String(UNKNOWN_JURISDICTION_ENABLED)}`,
      `ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL=${String(ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL)}`,
      `SUNREY_SCOPE_EQUALS_MOONREY_SCOPE=${String(SUNREY_SCOPE_EQUALS_MOONREY_SCOPE)}`,
      `EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE=${String(EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE)}`,
      `AI_CAN_APPROVE_JURISDICTION=${String(AI_CAN_APPROVE_JURISDICTION)}`,
      `PRODUCTION_ACTIVE=${String(PRODUCTION_ACTIVE)}`,
    ].join('\n'),
  );
  process.stdout.write('\n');
  if (
    UNKNOWN_JURISDICTION_ENABLED ||
    ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL ||
    SUNREY_SCOPE_EQUALS_MOONREY_SCOPE ||
    EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE ||
    AI_CAN_APPROVE_JURISDICTION ||
    PRODUCTION_ACTIVE ||
    initial.productionActive ||
    withRefs.eligible
  ) {
    process.exitCode = 1;
  }
}

runOperatingScopeDemo();
