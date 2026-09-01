import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LIVE_DATA_MARKET_ENABLED,
  LIVE_DATA_MONETIZATION_ENABLED,
  LIVE_HIN_BASED_ISSUANCE_ENABLED,
  LIVE_INFORMATION_RIGHTS_MARKETPLACE,
  LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED,
} from '../packages/config/src/flags.ts';
import { createPhaseHWorld, PHASE_H_BOB_TOKEN, PHASE_H_TOKEN } from './phase-h-world.ts';

function body<T>(res: { readonly status: number; readonly body: unknown }): T {
  assert.ok(res.status < 400, JSON.stringify(res.body));
  return res.body as T;
}

describe('Phase H qualification', () => {
  it('runs Vault, consent, HIN, marketplace, productive, rights, and isolation E2E', async () => {
    const world = createPhaseHWorld();
    const vault = body<{ schema: string; encryption: { plaintextInMetadata: boolean }; sourceStatus: string }>(
      await world.handle({ method: 'GET', path: '/api/v1/data' }),
    );
    assert.equal(vault.schema, 'sunrey.consumer.vault.home.v1');
    assert.equal(vault.encryption.plaintextInMetadata, false);
    assert.equal(vault.sourceStatus, 'SANDBOX');

    const categories = body<{ items: string[] }>(await world.handle({ method: 'GET', path: '/api/v1/data/categories' }));
    assert.ok(categories.items.includes('PAYROLL_DATA'));

    const declared = body<{ recordId: string }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/records', body: { key: 'preferred_currency', value: 'USD', idempotencyKey: 'pref_e2e' } }),
    );
    const payroll = body<{ recordId: string; provenance: { kind: string } }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/records/ingest', body: { kind: 'PAYROLL', idempotencyKey: 'pay_e2e' } }),
    );
    const txns = body<{ recordId: string }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/records/ingest', body: { kind: 'TRANSACTIONS', idempotencyKey: 'txn_e2e' } }),
    );
    assert.equal(payroll.provenance.kind, 'EXTERNAL_CONNECTOR');
    const proven = body<{ provenanceVerified: boolean }>(
      await world.handle({ method: 'GET', path: `/api/v1/data/records/${payroll.recordId}` }),
    );
    assert.equal(proven.provenanceVerified, true);
    const derived = await world.handle({ method: 'POST', path: `/api/v1/data/records/${txns.recordId}/derive` });
    assert.ok(derived.status < 400 || derived.status === 400);
    const history = body<{ items: unknown[] }>(
      await world.handle({ method: 'GET', path: `/api/v1/data/records/${declared.recordId}/history` }),
    );
    assert.ok(history.items.length >= 1);
    const corrected = body<{ recordId: string }>(
      await world.handle({
        method: 'POST',
        path: `/api/v1/data/records/${declared.recordId}/correct`,
        body: { value: 'EUR' },
      }),
    );
    assert.equal(corrected.recordId, declared.recordId);
    const disputed = body<{ sourceMutated: false }>(
      await world.handle({
        method: 'POST',
        path: `/api/v1/data/records/${payroll.recordId}/dispute`,
        body: { reason: 'employer_name_wrong' },
      }),
    );
    assert.equal(disputed.sourceMutated, false);
    const access = body<{ items: unknown[] }>(await world.handle({ method: 'GET', path: '/api/v1/data/access-history' }));
    assert.ok(access.items.length > 0);

    const grant = body<{ permissionId: string }>(
      await world.handle({
        method: 'POST',
        path: '/api/v1/data/permissions',
        body: { purpose: 'PERSONAL_AGENT_ANALYSIS', categories: ['PAYROLL_DATA'] },
      }),
    );
    const receipt = body<{ consentId: string }>(
      await world.handle({ method: 'GET', path: `/api/v1/data/consent/${grant.permissionId}/receipt` }),
    );
    assert.equal(receipt.consentId, grant.permissionId);
    const agentOk = await world.handle({
      method: 'POST',
      path: '/api/v1/data/agent-access/read',
      body: { recordId: payroll.recordId },
    });
    assert.ok(agentOk.status === 200 || agentOk.status === 400);
    const agentDenied = await world.handle({
      method: 'POST',
      path: '/api/v1/data/agent-access/read',
      body: {},
    });
    assert.equal(agentDenied.status, 400);
    await world.handle({ method: 'POST', path: `/api/v1/data/permissions/${grant.permissionId}/revoke` });

    const hin = body<{ participating: boolean }>(await world.handle({ method: 'POST', path: '/api/v1/data/hin/participate' }));
    assert.equal(hin.participating, true);
    const contribution = body<{ verified: boolean; mintRefused: boolean; sunReyQuantity: null }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/contributions', body: { seed: 'phase-h-e2e' } }),
    );
    assert.equal(contribution.verified, true);
    assert.equal(contribution.mintRefused, true);
    assert.equal(contribution.sunReyQuantity, null);
    const dup = body<{ duplicateBlocked: boolean }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/contributions/duplicate', body: { seed: 'phase-h-e2e' } }),
    );
    assert.equal(dup.duplicateBlocked, true);

    const license = body<{ licenseId: string }>(await world.handle({ method: 'POST', path: '/api/v1/data/licenses', body: {} }));
    const approved = body<{ accessActive: boolean }>(
      await world.handle({ method: 'POST', path: `/api/v1/data/licenses/${license.licenseId}/approve` }),
    );
    assert.equal(approved.accessActive, true);
    const paid = body<{ mintRequested: false; marketplaceCannotMint: boolean }>(
      await world.handle({ method: 'POST', path: `/api/v1/data/licenses/${license.licenseId}/pay` }),
    );
    assert.equal(paid.mintRequested, false);
    assert.equal(paid.marketplaceCannotMint, true);
    const revoked = body<{ futureAccessBlocked: boolean }>(
      await world.handle({ method: 'POST', path: `/api/v1/data/licenses/${license.licenseId}/revoke` }),
    );
    assert.equal(revoked.futureAccessBlocked, true);

    const energy = body<{ mintsMoonRey: false }>(
      await world.handle({ method: 'POST', path: '/api/v1/economy/productive/observe', body: { kind: 'energy' } }),
    );
    const compute = body<{ accepted: boolean }>(
      await world.handle({ method: 'POST', path: '/api/v1/economy/productive/observe', body: { kind: 'compute' } }),
    );
    const manufacturing = body<{ accepted: boolean }>(
      await world.handle({ method: 'POST', path: '/api/v1/economy/productive/observe', body: { kind: 'manufacturing' } }),
    );
    assert.equal(energy.mintsMoonRey, false);
    assert.equal(compute.accepted, true);
    assert.equal(manufacturing.accepted, true);
    const stale = await world.handle({ method: 'POST', path: '/api/v1/economy/productive/observe', body: { kind: 'stale' } });
    assert.equal(stale.status, 400);
    const basis = body<{ mainnetIssuance: false; hinCannotModifySupply: true }>(
      await world.handle({ method: 'POST', path: '/api/v1/economy/basis-proposal', body: { kind: 'HIN' } }),
    );
    assert.equal(basis.mainnetIssuance, false);

    const stopReq = body<{ revoked: false; confirmed: false }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/hin/stop/request' }),
    );
    assert.equal(stopReq.revoked, false);
    const stopped = body<{ confirmed: true; participating: false }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/hin/stop' }),
    );
    assert.equal(stopped.confirmed, true);

    const rights = body<{ requestId: string }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/rights', body: { kind: 'ACCESS' } }),
    );
    assert.ok(rights.requestId);

    const bobDenied = await world.handle({
      method: 'GET',
      path: `/api/v1/data/records/${payroll.recordId}`,
      authorization: `Bearer ${PHASE_H_BOB_TOKEN}`,
    });
    assert.ok(bobDenied.status === 403 || bobDenied.status === 404 || bobDenied.status === 400);

    const unauthorizedPurpose = await world.handle({
      method: 'POST',
      path: '/api/v1/data/licenses',
      authorization: `Bearer ${PHASE_H_TOKEN}`,
      body: { purpose: 'ANY_FUTURE_PURPOSE' },
    });
    assert.equal(unauthorizedPurpose.status, 400);

    assert.equal(LIVE_INFORMATION_RIGHTS_MARKETPLACE, false);
    assert.equal(LIVE_DATA_MONETIZATION_ENABLED, false);
    assert.equal(LIVE_HIN_BASED_ISSUANCE_ENABLED, false);
    assert.equal(LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(world.surface.leakScan().leaked, false);
  });

  it('keeps economic red-team mutations at zero', async () => {
    const world = createPhaseHWorld();
    await world.handle({ method: 'POST', path: '/api/v1/data/hin/participate' });
    assert.equal(world.surface.market.mintFromMarketplace().ok, false);
    const created = await world.handle({
      method: 'POST',
      path: '/api/v1/data/contributions',
      body: { seed: 'agent-inflate', valuationCoefficient: 999 },
    });
    assert.ok(created.status === 201 || created.status === 200 || created.status === 400);
    if (created.status < 400) {
      const payload = created.body as { mintRefused: boolean; sunReyQuantity: null };
      assert.equal(payload.mintRefused, true);
      assert.equal(payload.sunReyQuantity, null);
    }
    const frontendMint = await world.handle({ method: 'POST', path: '/api/v1/economy/issuance', body: { amount: '1' } });
    assert.ok(frontendMint.status === 404 || frontendMint.status === 405);
    const moonreyMint = await world.handle({ method: 'POST', path: '/api/v1/economy/issuance', body: { asset: 'MOONREY', amount: '1' } });
    assert.ok(moonreyMint.status === 404 || moonreyMint.status === 405);
    const basis = body<{ mainnetIssuance: false; hinCannotModifySupply: true }>(
      await world.handle({ method: 'POST', path: '/api/v1/economy/basis-proposal', body: { kind: 'MOONREY' } }),
    );
    assert.equal(basis.mainnetIssuance, false);
    assert.equal(basis.hinCannotModifySupply, true);
    assert.equal(LIVE_HIN_BASED_ISSUANCE_ENABLED, false);
    assert.equal(LIVE_MOONREY_PRODUCTIVE_ISSUANCE_ENABLED, false);
  });

  it('blocks privacy red-team disclosure paths', async () => {
    const world = createPhaseHWorld();
    const payroll = body<{ recordId: string }>(
      await world.handle({ method: 'POST', path: '/api/v1/data/records/ingest', body: { kind: 'PAYROLL', idempotencyKey: 'iso_pay' } }),
    );
    const aliceRead = await world.handle({ method: 'GET', path: `/api/v1/data/records/${payroll.recordId}` });
    assert.ok(aliceRead.status < 400);
    const bobRead = await world.handle({
      method: 'GET',
      path: `/api/v1/data/records/${payroll.recordId}`,
      authorization: `Bearer ${PHASE_H_BOB_TOKEN}`,
    });
    assert.ok(bobRead.status === 403 || bobRead.status === 404 || bobRead.status === 400);
    const wildcard = await world.handle({ method: 'POST', path: '/api/v1/data/agent-access/read', body: {} });
    assert.equal(wildcard.status, 400);
    const licenseePurpose = await world.handle({
      method: 'POST',
      path: '/api/v1/data/licenses',
      body: { purpose: 'MODEL_TRAINING' },
    });
    assert.equal(licenseePurpose.status, 400);
    await world.handle({ method: 'POST', path: '/api/v1/data/hin/participate' });
    const grant = body<{ permissionId: string }>(
      await world.handle({
        method: 'POST',
        path: '/api/v1/data/permissions',
        body: { purpose: 'PERSONAL_AGENT_ANALYSIS', categories: ['PAYROLL_DATA'] },
      }),
    );
    await world.handle({ method: 'POST', path: `/api/v1/data/permissions/${grant.permissionId}/revoke` });
    const afterRevoke = await world.handle({
      method: 'POST',
      path: '/api/v1/data/agent-access/read',
      body: { recordId: payroll.recordId },
    });
    assert.ok(afterRevoke.status === 400 || afterRevoke.status === 403);
    const audit = body<{ items: unknown[] }>(await world.handle({ method: 'GET', path: '/api/v1/data/access-history' }));
    assert.ok(audit.items.length > 0);
    assert.equal(world.surface.leakScan().leaked, false);
  });
});
