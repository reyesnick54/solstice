import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asActionIntentId,
  asActorId,
  asCustomerId,
  asIdempotencyKey,
  asUtcInstant,
} from '@solstice/domain';
import { ComplianceKernel, freezeIntent } from '@solstice/kernel';
import { ConsentLedger } from '@solstice/consent';
import { CleanRoom } from './clean-room.ts';

const NOW = asUtcInstant('2026-08-14T16:00:00.000Z');

describe('Clean Room', () => {
  it('halts and considers zero records when consent is revoked', () => {
    const kernel = new ComplianceKernel();
    const consents = new ConsentLedger();
    const room = new CleanRoom();
    const customerId = asCustomerId('cust_halt');
    consents.offer({
      id: 'consent_halt',
      customerId,
      requestId: 'req_h',
      categories: ['WELLNESS'],
      purpose: 'research',
      jurisdiction: 'US',
      offeredAt: NOW,
    });
    const run = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_cr'),
        kind: 'RUN_CLEAN_ROOM',
        actor: { type: 'SYSTEM', id: asActorId('system') },
        payload: { requestId: 'req_h' },
        idempotencyKey: asIdempotencyKey('idem_cr'),
        occurredAt: NOW,
        sourceJurisdiction: 'US',
      }),
    );
    assert.equal(run.ok && run.value.outcome === 'AUTHORIZED', true);
    if (!run.ok || run.value.outcome !== 'AUTHORIZED') return;
    const result = room.run(run.value.authorization, {
      jobId: 'job_halt',
      requestId: 'req_h',
      consentReferences: ['consent_halt'],
      purpose: 'research',
      consentLedger: consents,
      at: NOW,
    });
    assert.equal(result.ok, false);
    const job = room.get('job_halt');
    assert.equal(job?.status, 'HALTED');
    assert.equal(job?.recordsConsidered, 0n);
  });
});
