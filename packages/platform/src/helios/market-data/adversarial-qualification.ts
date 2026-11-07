import { LIVE_TRADING_ENABLED, MARKET_DATA_LIVE_SHADOW_ENABLED } from '@solstice/config';

import { mayAafCertifyMarketDataFeature, type MarketDataAafFeatureEnvelope } from './aaf-integration.ts';
import { assertMarketDataLiveShadowSafe, describeMarketDataLiveShadowPosture } from './live-shadow.ts';
import { decideProviderMarketDataStatus, fixtureSandboxProviderEvidence } from './provider-qualification.ts';
import {
  MD14_ADVERSARIAL_SCENARIO_IDS,
  type Md14AdversarialScenarioId,
} from './taxonomy.ts';

export type Md14AdversarialScenarioResult = {
  readonly scenarioId: Md14AdversarialScenarioId;
  readonly passed: boolean;
  readonly detail: string;
};

function scenario(
  scenarioId: Md14AdversarialScenarioId,
  passed: boolean,
  detail: string,
): Md14AdversarialScenarioResult {
  return Object.freeze({ scenarioId, passed, detail });
}

export function runMd14AdversarialScenario(scenarioId: Md14AdversarialScenarioId): Md14AdversarialScenarioResult {
  switch (scenarioId) {
    case 'md14_gap_recovery': {
      const env: MarketDataAafFeatureEnvelope = Object.freeze({
        eventTime: '2026-01-02T15:00:00.000Z',
        knowableAt: '2026-01-02T15:00:01.000Z',
        providerLineageRef: 'prov:fixture:primary',
        sequenceIntegrity: 'GAP_RECOVERED',
        qualityState: 'VALID',
        entitlementState: 'USABLE',
        syncState: 'TRUSTED',
      });
      return scenario(scenarioId, mayAafCertifyMarketDataFeature(env), 'gap recovered observations may certify');
    }
    case 'md14_clock_skew': {
      const env: MarketDataAafFeatureEnvelope = Object.freeze({
        eventTime: '2026-01-02T15:00:05.000Z',
        knowableAt: '2026-01-02T15:00:04.000Z',
        providerLineageRef: 'prov:fixture:primary',
        sequenceIntegrity: 'INTACT',
        qualityState: 'VALID',
        entitlementState: 'USABLE',
        syncState: 'TRUSTED',
      });
      return scenario(scenarioId, !mayAafCertifyMarketDataFeature(env), 'knowableAt before eventTime rejected');
    }
    case 'md14_entitlement_block': {
      const env: MarketDataAafFeatureEnvelope = Object.freeze({
        eventTime: '2026-01-02T15:00:00.000Z',
        knowableAt: '2026-01-02T15:00:01.000Z',
        providerLineageRef: 'prov:fixture:primary',
        sequenceIntegrity: 'INTACT',
        qualityState: 'VALID',
        entitlementState: 'ENTITLEMENT_BLOCKED',
        syncState: 'ENTITLEMENT_BLOCKED',
      });
      return scenario(scenarioId, !mayAafCertifyMarketDataFeature(env), 'entitlement block rejects AAF certification');
    }
    case 'md14_redundant_source_divergence': {
      const env: MarketDataAafFeatureEnvelope = Object.freeze({
        eventTime: '2026-01-02T15:00:00.000Z',
        knowableAt: '2026-01-02T15:00:01.000Z',
        providerLineageRef: 'prov:fixture:divergent',
        sequenceIntegrity: 'INTACT',
        qualityState: 'UNTRUSTED',
        entitlementState: 'USABLE',
        syncState: 'UNTRUSTED',
      });
      return scenario(scenarioId, !mayAafCertifyMarketDataFeature(env), 'untrusted quality blocks certification');
    }
    case 'md14_chaos_provider_outage': {
      const fixture = fixtureSandboxProviderEvidence('chaos_fixture');
      const decision = decideProviderMarketDataStatus(fixture);
      return scenario(
        scenarioId,
        decision.status === 'SANDBOX_QUALIFIED' && !decision.liveShadowEligible,
        'fixture providers stay sandbox-qualified without live shadow',
      );
    }
    case 'md14_aaf_block_on_untrusted': {
      const env: MarketDataAafFeatureEnvelope = Object.freeze({
        eventTime: '2026-01-02T15:00:00.000Z',
        knowableAt: '2026-01-02T15:00:01.000Z',
        providerLineageRef: 'prov:fixture:primary',
        sequenceIntegrity: 'DESYNCHRONIZED',
        qualityState: 'VALID',
        entitlementState: 'USABLE',
        syncState: 'DESYNCHRONIZED',
      });
      return scenario(scenarioId, !mayAafCertifyMarketDataFeature(env), 'desynchronized sequence blocks AAF');
    }
    case 'md14_execution_twin_no_live_submit': {
      const posture = describeMarketDataLiveShadowPosture();
      return scenario(
        scenarioId,
        LIVE_TRADING_ENABLED === false && posture.permitsBrokerOrders === false,
        'execution twin paper path has no broker submit',
      );
    }
    case 'md14_live_shadow_no_execution_authority': {
      try {
        assertMarketDataLiveShadowSafe();
        const shadowOff = MARKET_DATA_LIVE_SHADOW_ENABLED === false;
        return scenario(scenarioId, shadowOff || LIVE_TRADING_ENABLED === false, 'live shadow posture safe');
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return scenario(scenarioId, false, message);
      }
    }
    default:
      return scenario(scenarioId, false, 'unknown scenario');
  }
}

export function runAllMd14AdversarialScenarios(): readonly Md14AdversarialScenarioResult[] {
  return Object.freeze(MD14_ADVERSARIAL_SCENARIO_IDS.map((id) => runMd14AdversarialScenario(id)));
}
