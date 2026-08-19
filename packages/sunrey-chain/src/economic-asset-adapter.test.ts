import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { createOracleEconomicAssetAdapter } from './oracle/economic-asset-adapter.ts';
import { createOnboardingDraft, emptyOnboardingEvidence } from './oracle/production/onboarding.ts';
import { createProductiveEconomicAssetAdapter } from './productive/economic-asset-adapter.ts';
import { fixtureObject } from './productive/fixtures.ts';

const NOW = asUtcInstant('2026-08-19T10:00:00.000Z');

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code?: string; readonly message?: string; readonly detail?: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code ?? 'ERR'}: ${result.error.message ?? result.error.detail ?? 'failed'}`);
  }
  return result.value;
}

describe('oracle and productive economic asset adapters', () => {
  it('projects an oracle source without credentials and a productive object without industrial payloads', () => {
    const registry = new EconomicAssetRegistry();
    const oracle = createOracleEconomicAssetAdapter(registry);
    const productive = createProductiveEconomicAssetAdapter(registry);
    const onboarding = unwrap(
      createOnboardingDraft({
        providerId: 'prov.energy.test',
        legalEntityReference: 'org.energy.test',
        controllerReference: 'ctl.energy.test',
        dataCategories: ['energy'],
        feeds: ['feed.energy.test'],
        authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
        signingKey: {
          schemaVersion: 1,
          keyId: 'key.energy.test',
          keyVersion: 1,
          publicKeyHex: 'pub-test',
          cryptoSuite: 'ed25519',
          signerKind: 'SOFTWARE_DEVELOPMENT',
          rotatedFromKeyId: null,
          active: true,
        },
        cryptoSuite: 'ed25519',
        infrastructureRegion: 'REGION_A',
        sourceRelationships: [
          {
            schemaVersion: 1,
            sourceId: 'src.energy.test',
            controllerId: 'ctl.energy.test',
            upstreamOrganizationId: 'org.energy.test',
            infrastructureRegion: 'REGION_A',
            sharedControlGroup: null,
          },
        ],
        onboardingEvidence: emptyOnboardingEvidence(),
        securityReviewStatus: 'NOT_REVIEWED',
        commercialAgreementEvidenceReference: null,
        status: 'DRAFT',
      }),
    );
    const source = unwrap(
      oracle.projectSource(
        {
          schemaVersion: 1,
          sourceId: 'src.energy.test',
          version: 1,
          providerId: 'prov.energy.test',
          category: 'energy',
          factType: 'ENERGY_PRODUCTION',
          feedId: 'feed.energy.test',
          unit: 'MWh',
          schemaId: 'energy.resource.v1',
          sourceSchemaVersion: 1,
          normalizationVersion: 'oracle.normalize.v1',
          authenticationMethod: 'FILE_FIXTURE_TEST_ONLY',
          credentialRef: null,
          controllerId: 'ctl.energy.test',
          upstreamOrganizationId: 'org.energy.test',
          infrastructureRegion: 'REGION_A',
          retired: false,
        },
        onboarding,
        NOW,
      ),
    );
    assert.equal(source.assetClass, 'ORACLE_SOURCE_DATASET');
    assert.equal(JSON.stringify(source).includes('apiKey'), false);
    const object = unwrap(productive.projectObject(fixtureObject({ objectId: 'obj.test', category: 'ENERGY', unitSchema: 'kWh' }), NOW));
    assert.equal(object.assetClass, 'PRODUCTIVE_ECONOMIC_OBJECT');
    assert.equal(object.automaticMoonReyQuantity, null);
  });
});
