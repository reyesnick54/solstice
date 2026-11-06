import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED,
  HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED,
  STRESS_CHALLENGER_KINDS,
  StrategyFalsificationAgent,
  buildDefaultStressCampaign,
  defaultHealthyConcentration,
} from '../packages/platform/src/helios/strategy-evolution/evol08/index.ts';

describe('HELIOS EVOL08 adversarial falsification engine', () => {
  it('exports qualification marker HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED', () => {
    assert.equal(
      HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED,
      'HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED',
    );
  });

  it('tests every stress challenger kind exactly once in the default campaign', () => {
    const campaign = buildDefaultStressCampaign('s_evol08');
    const kinds = campaign.challenges.map((c) => c.kind);
    assert.equal(kinds.length, STRESS_CHALLENGER_KINDS.length);
    const set = new Set(kinds);
    assert.equal(set.size, kinds.length);
    for (const k of STRESS_CHALLENGER_KINDS) {
      assert.ok(set.has(k));
    }
  });

  it('qualifies only via deterministic gates — agents do not set the marker', () => {
    const agent = new StrategyFalsificationAgent();
    const healthy = defaultHealthyConcentration();
    const ok = agent.run({
      strategyId: 's_ok',
      campaign: buildDefaultStressCampaign('s_ok'),
      baselineEdgeBps: 4000,
      concentration: healthy,
      thresholdSensitivityFragile: false,
    });
    assert.equal(ok.qualification.marker, HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED);
    assert.equal(ok.grantsFinancialAuthority, false);

    const blocked = agent.run({
      strategyId: 's_bad',
      campaign: buildDefaultStressCampaign('s_bad'),
      baselineEdgeBps: 200,
      concentration: healthy,
      thresholdSensitivityFragile: false,
    });
    assert.equal(blocked.qualification.marker, HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED);
  });

  it('blocks qualification when structural concentration or threshold fragility triggers', () => {
    const agent = new StrategyFalsificationAgent();
    const report = agent.run({
      strategyId: 's_fragile',
      campaign: buildDefaultStressCampaign('s_fragile'),
      baselineEdgeBps: 4000,
      concentration: {
        topInstrumentShareBps: 9000,
        topYearShareBps: 9000,
        topSectorShareBps: 9000,
        topRegimeShareBps: 9000,
        topProviderShareBps: 9000,
        topTradeShareBps: 9000,
        extremeEventDependenceBps: 9000,
      },
      thresholdSensitivityFragile: false,
    });
    assert.equal(report.qualification.marker, HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED);

    const threshold = agent.run({
      strategyId: 's_thresh',
      campaign: buildDefaultStressCampaign('s_thresh'),
      baselineEdgeBps: 4000,
      concentration: defaultHealthyConcentration(),
      thresholdSensitivityFragile: true,
    });
    assert.equal(threshold.qualification.marker, HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED);
  });
});
