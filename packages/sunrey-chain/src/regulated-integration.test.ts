import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { defaultActivationMatrix, unlicensedCapabilitiesRemainUnavailable } from './mainnet/capabilities.ts';
import { applyRegulatedReadinessFeed } from './mainnet/regulated-feed.ts';

describe('chunk 69 readiness feed into chunk 65 matrices', () => {
  it('records software readiness without enabling runtime or inheriting licenses', () => {
    const fed = applyRegulatedReadinessFeed(defaultActivationMatrix(), [
      {
        capability: 'SUNREY_EXCHANGE',
        software_ready: true,
        security_ready: false,
        operational_ready: false,
        legal_ready: false,
        regulatory_ready: false,
        license_or_partner_ready: false,
        human_authorized: false,
      },
      {
        capability: 'INSTITUTIONAL_CUSTODY',
        software_ready: true,
        security_ready: false,
        operational_ready: false,
        legal_ready: false,
        regulatory_ready: false,
        license_or_partner_ready: false,
        human_authorized: false,
      },
      {
        capability: 'HUMAN_INFORMATION_MARKET',
        software_ready: true,
        security_ready: false,
        operational_ready: false,
        legal_ready: false,
        regulatory_ready: false,
        license_or_partner_ready: false,
        human_authorized: false,
      },
      {
        capability: 'PRODUCTIVE_CAPACITY_MARKET',
        software_ready: true,
        security_ready: false,
        operational_ready: false,
        legal_ready: false,
        regulatory_ready: false,
        license_or_partner_ready: false,
        human_authorized: false,
      },
    ]);
    const exchange = fed.find((row) => row.capability === 'SUNREY_EXCHANGE');
    assert.equal(exchange?.software_ready, true);
    assert.equal(exchange?.runtime_enabled, false);
    assert.equal(exchange?.genesis_enabled, false);
    assert.equal(unlicensedCapabilitiesRemainUnavailable(fed), true);
  });
});
