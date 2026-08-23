/**
 * Production database security bindings. Extends the existing production
 * profile. Application connections are never the PostgreSQL superuser.
 */

import {
  assertApplicationRole,
  assertDatabaseTls,
  PRODUCTION_DATABASE_CONTROLS,
} from '../../../security/src/productization/database.ts';
import { productionCandidateProfile } from './profile.ts';

export function assertProductionDatabaseSecurity(): typeof PRODUCTION_DATABASE_CONTROLS {
  const profile = productionCandidateProfile();
  const tls = assertDatabaseTls(profile.tls.enabled);
  if (!tls.ok) {
    throw new Error(tls.error.message);
  }
  for (const role of ['customer_app', 'ledger_writer', 'ledger_reader', 'evidence_app', 'security_app', 'solstice_migrator']) {
    const check = assertApplicationRole(role);
    if (!check.ok) {
      throw new Error(check.error.message);
    }
  }
  const bootstrap = assertApplicationRole('postgres');
  if (bootstrap.ok) {
    throw new Error('postgres superuser must be refused for application traffic');
  }
  return PRODUCTION_DATABASE_CONTROLS;
}
