import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { ACCESS_ECONOMY_ISOLATION } from './isolation.ts';
import { accessRegistryIntentIdFor, accessRegistryRightIdFor, capacityRefFor } from './registry-ids.ts';
import { AccessFabric } from './service.ts';

const NOW = asUtcInstant('2026-08-29T10:00:00.000Z');
const LATER = asUtcInstant('2026-08-30T10:00:00.000Z');

describe('ACCESS-01 access fabric foundation', () => {
  it('exports the canonical isolation contract', () => {
    assert.equal(ACCESS_ECONOMY_ISOLATION.capability, 'sunrey-access-economy-domain');
    assert.equal(ACCESS_ECONOMY_ISOLATION.owner, 'packages/access-economy');
    assert.equal(ACCESS_ECONOMY_ISOLATION.accessCoinImplemented, false);
  });

  it('records a non-ownership AccessRight without settlement or mint semantics', () => {
    const fabric = new AccessFabric();
    const result = fabric.registerRight({
      id: accessRegistryRightIdFor('housing-1'),
      subjectRef: 'subj_demo',
      capacityRef: capacityRefFor('room-101'),
      category: 'HOUSING_ROOM_NIGHTS',
      bounds: [
        { kind: 'TIME', notBefore: NOW, notAfter: LATER },
        { kind: 'QUANTITY', unit: 'room_night', quantity: 2n },
      ],
      createdAt: NOW,
      updatedAt: NOW,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.isOwnership, false);
    assert.equal(result.value.isMoney, false);
    assert.equal(result.value.grantsMint, false);
    assert.equal(result.value.impliesSettlement, false);
    assert.equal(result.value.valuesHuman, false);
    assert.equal(result.value.category, 'HOUSING_ROOM_NIGHTS');
  });

  it('accepts an AccessIntent that is not an ActionIntent or Execution Authority', () => {
    const fabric = new AccessFabric();
    const result = fabric.proposeIntent({
      id: accessRegistryIntentIdFor('compute-1'),
      kind: 'REQUEST',
      subjectRef: 'subj_demo',
      capacityRef: capacityRefFor('gpu-a1'),
      category: 'COMPUTE',
      bounds: [{ kind: 'USAGE', meter: 'gpu_second', allowance: 3600n }],
      purposeRef: 'purpose_research',
      pegContextRef: 'peg_ctx_demo',
      proposedAt: NOW,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.isActionIntent, false);
    assert.equal(result.value.isExecutionAuthority, false);
    assert.equal(result.value.pegContextRef, 'peg_ctx_demo');
  });

  it('refuses forbidden human-worth and access-coin payload fields', () => {
    const fabric = new AccessFabric();
    const result = fabric.proposeIntent({
      id: accessRegistryIntentIdFor('bad-1'),
      kind: 'REQUEST',
      subjectRef: 'subj_demo',
      capacityRef: capacityRefFor('svc-1'),
      category: 'SERVICES',
      bounds: [{ kind: 'TIME', notBefore: NOW, notAfter: LATER }],
      purposeRef: 'purpose_demo',
      proposedAt: NOW,
      humanWorthScore: 99,
    } as never);

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'FORBIDDEN_HUMAN_WORTH_FIELD');
  });
});
