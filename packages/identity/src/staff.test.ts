import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { capabilitiesForStaffRoles, staffRolesFromCapabilities } from './admin-roles.ts';
import { evaluateSegregationOfDuties } from './staff/sod.ts';

describe('staff roles and segregation of duties', () => {
  it('does not give PLATFORM_ADMIN every operational role', () => {
    const roles = staffRolesFromCapabilities(['ADMIN_PLATFORM']);
    assert.deepEqual([...roles], ['PLATFORM_ADMIN']);
    assert.equal(capabilitiesForStaffRoles(['PLATFORM_ADMIN']).includes('ADMIN_COMPLIANCE_APPROVE'), false);
    assert.equal(capabilitiesForStaffRoles(['CUSTOMER_SUPPORT']).includes('CUSTODY_OPERATE_REQUEST'), false);
    assert.equal(capabilitiesForStaffRoles(['CUSTOMER_SUPPORT']).includes('TREASURY_OPERATE_REQUEST'), false);
  });

  it('blocks support custody signing, agent ledger mutation, and provider production activation', () => {
    const support = evaluateSegregationOfDuties({
      roles: ['CUSTOMER_SUPPORT'],
      capabilities: ['ADMIN_SUPPORT', 'CUSTODY_OPERATE_REQUEST'],
      action: 'SUPPORT_VIEW_OPEN',
      actorId: 'support_1',
    });
    assert.equal(support.ok, false);
    if (!support.ok) {
      assert.ok(support.code === 'SUPPORT_CANNOT_SIGN' || support.code === 'LEDGER_MUTATION_FORBIDDEN');
    }
    const agent = evaluateSegregationOfDuties({
      roles: ['PLATFORM_ADMIN'],
      capabilities: ['ADMIN_PLATFORM', 'ADMIN_AGENT', 'TRANSFER_REQUEST'],
      action: 'CASE_NOTE',
      actorId: 'plat_1',
    });
    assert.equal(agent.ok, false);
    if (!agent.ok) {
      assert.equal(agent.code, 'AGENT_CANNOT_MUTATE_LEDGER');
    }
    const production = evaluateSegregationOfDuties({
      roles: ['SRE_OPERATOR'],
      capabilities: ['ADMIN_SRE'],
      action: 'PROVIDER_CONFIGURE',
      actorId: 'sre_1',
      productionActivation: true,
    });
    assert.equal(production.ok, false);
    if (!production.ok) {
      assert.equal(production.code, 'PRODUCTION_ACTIVATION_FORBIDDEN');
    }
  });

  it('requires a second person for dual-control actions', () => {
    const first = evaluateSegregationOfDuties({
      roles: ['SECURITY_OPERATOR'],
      capabilities: ['ADMIN_SECURITY'],
      action: 'MARKET_HALT',
      actorId: 'sec_1',
    });
    assert.equal(first.ok, false);
    if (!first.ok) {
      assert.equal(first.code, 'DUAL_CONTROL_REQUIRED');
    }
    const second = evaluateSegregationOfDuties({
      roles: ['SECURITY_OPERATOR'],
      capabilities: ['ADMIN_SECURITY'],
      action: 'MARKET_HALT',
      actorId: 'sec_1',
      secondApproverId: 'surv_1',
      dualControlSatisfied: true,
    });
    assert.equal(second.ok, true);
  });
});
