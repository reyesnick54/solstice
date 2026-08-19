import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { createHinEconomicAssetAdapter } from './network/economic-asset-adapter.ts';
import { HumanInformationNetworkEngine } from './network/engine.ts';

const NOW = asUtcInstant('2026-08-19T10:00:00.000Z');

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

describe('HIN economic asset adapter', () => {
  it('projects a privacy-safe information descriptor', () => {
    const engine = new HumanInformationNetworkEngine({ clock: new FrozenClock(NOW) });
    const subject = unwrap(engine.registerSubject({ internalRef: 'synthetic-ada' }));
    const descriptor = unwrap(
      engine.registerDescriptor({
        subjectId: subject.subjectId,
        category: 'FINANCIAL_ACTIVITY_METADATA',
        schema: 'activity-metadata-v1',
        sourceClass: 'PERSONAL_DATA_VAULT',
        freshness: 'P30D',
        sensitivityClass: 'SENSITIVE',
        permittedComputationClasses: ['CLEAN_ROOM_COMPUTATION'],
      }),
    );
    const adapter = createHinEconomicAssetAdapter(new EconomicAssetRegistry());
    const projected = unwrap(adapter.projectInformationAsset({ descriptor, subject, at: NOW }));
    assert.equal(projected.assetClass, 'INFORMATION_ASSET');
    assert.equal(projected.chainAnchor?.finalityState, 'UNANCHORED');
    assert.equal(projected.privacyBoundary.containRawSensitiveData, false);
    assert.equal(JSON.stringify(projected).includes('legalName'), false);
  });
});
