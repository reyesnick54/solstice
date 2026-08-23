import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { staffOperatorFromRoles } from '../../../identity/src/staff/operator.ts';
import { OperationsControlPlane } from '../../../kernel/src/operations/service.ts';
import { MemoryOperationsControlStore } from './memory-store.ts';

const NOW = asUtcInstant('2026-08-23T12:00:00.000Z');

describe('operations control persistence', () => {
  it('keeps cases and operator actions after a simulated restart', () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const live = new OperationsControlPlane({ clock, evidence });
    const analyst = staffOperatorFromRoles({
      operatorId: 'analyst_pg',
      identityId: 'id_analyst_pg',
      roles: ['COMPLIANCE_ANALYST'],
      assurance: 'STRONG',
      stepUpSatisfied: true,
      sessionId: 'sess_pg',
    });
    const opened = live.createCase({
      operator: analyst,
      domain: 'KYC',
      type: 'KYC_EXCEPTION',
      subject: 'cust_kyc',
      severity: 'MEDIUM',
      source: 'PROVIDER',
      reason: 'document mismatch',
    });
    assert.equal(opened.ok, true);
    const durable = new MemoryOperationsControlStore();
    durable.import(live.exportSnapshot());
    const restarted = new OperationsControlPlane({ clock, evidence: new EvidenceVault(clock) });
    restarted.importSnapshot(durable.export());
    assert.equal(restarted.exportSnapshot().cases.length, 1);
    assert.equal(restarted.exportSnapshot().cases[0]?.domain, 'KYC');
    assert.ok(restarted.exportSnapshot().actions.length >= 1);
  });
});
