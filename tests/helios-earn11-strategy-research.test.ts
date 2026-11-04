/**
 * HELIOS EARN11 — earnings strategy genome and event research lab qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compileResearchMonitorDefinition } from '../packages/platform/src/helios/research-monitor/index.ts';
import {
  DEFAULT_EARN11_EVENT_EXECUTION_PROFILE,
  EARN11_RESEARCH_MONITORS,
  earningsPromotionBlockedByBarMode,
  earn11MonitorsTriggerResearchOnly,
  gateEarningsEventExecutionProfile,
} from '../packages/platform/src/helios/earnings-intelligence/index.ts';
import {
  EARN11_RESEARCH_TEMPLATE_FAMILIES,
  EARN11_MANDATORY_RESEARCH_ARTIFACTS,
  HELIOS_EARN11,
  HELIOS_EARN11_STRATEGY_RESEARCH_QUALIFIED,
  allEarn11ResearchTemplateGenomes,
  buildEarn11FixtureResearchArtifacts,
  compileEarn11StrategyGenome,
  evaluateEarn11StrategyResearchQualification,
  gateEarn11ResearchArtifacts,
  validateEarn11StrategyGenome,
} from '../packages/strategy-lab/src/earn11/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS EARN11 earnings strategy research lab', () => {
  it('exports work package marker', () => {
    assert.equal(HELIOS_EARN11, 'HELIOS_EARN11');
  });

  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('registers nine research template families (not proven strategies)', () => {
    assert.equal(EARN11_RESEARCH_TEMPLATE_FAMILIES.length, 9);
    const genomes = allEarn11ResearchTemplateGenomes();
    assert.equal(genomes.length, 9);
    for (const genome of genomes) {
      const validated = validateEarn11StrategyGenome(genome);
      assert.equal(validated.ok, true, validated.ok ? '' : validated.error.message);
      assert.equal(genome.parameters.researchOnly, true);
    }
  });

  it('requires AAF V2 and mandatory research artifacts before paper stage', () => {
    const genome = allEarn11ResearchTemplateGenomes()[0]!;
    const withoutArtifacts = compileEarn11StrategyGenome(genome, null, 'PAPER');
    assert.equal(withoutArtifacts.ok, false);
    const artifacts = buildEarn11FixtureResearchArtifacts();
    assert.equal(gateEarn11ResearchArtifacts(artifacts).complete, true);
    const withArtifacts = compileEarn11StrategyGenome(genome, artifacts, 'PAPER');
    assert.equal(withArtifacts.ok, true);
    assert.equal(withArtifacts.value.liveExecutionPermitted, false);
    assert.ok(withArtifacts.value.capsuleCandidate);
  });

  it('mandates earnings event execution twin (no close-to-close-only promotion)', () => {
    const gate = gateEarningsEventExecutionProfile(DEFAULT_EARN11_EVENT_EXECUTION_PROFILE);
    assert.equal(gate.acceptable, true, gate.blockers.join('; '));
    assert.equal(earningsPromotionBlockedByBarMode('CLOSE_ONLY'), true);
    assert.equal(earningsPromotionBlockedByBarMode('DETERMINISTIC_OHLC_PATH'), false);
  });

  it('research monitors request research only', () => {
    assert.equal(earn11MonitorsTriggerResearchOnly(), true);
    for (const monitor of EARN11_RESEARCH_MONITORS) {
      const compiled = compileResearchMonitorDefinition(monitor, monitor.startAt);
      assert.equal(compiled.ok, true);
      if (!compiled.ok) continue;
      assert.equal(compiled.manifest.grantsTradingAction, false);
      assert.equal(compiled.manifest.trigger.action, 'REQUEST_RESEARCH');
    }
  });

  it('emits HELIOS_EARN11_STRATEGY_RESEARCH_QUALIFIED when checks pass', () => {
    const genome = allEarn11ResearchTemplateGenomes()[0]!;
    const artifacts = buildEarn11FixtureResearchArtifacts();
    const compiled = compileEarn11StrategyGenome(genome, artifacts, 'PAPER');
    assert.equal(compiled.ok, true);

    const result = evaluateEarn11StrategyResearchQualification({
      allTemplateFamiliesRegistered: EARN11_RESEARCH_TEMPLATE_FAMILIES.length === 9,
      genomeCatalogExtended: true,
      aafV2Mandatory: true,
      mandatoryResearchArtifactsEnforced: EARN11_MANDATORY_RESEARCH_ARTIFACTS.length === 7,
      executionTwinEventProfileRequired: gateEarningsEventExecutionProfile(DEFAULT_EARN11_EVENT_EXECUTION_PROFILE)
        .acceptable,
      researchMonitorsResearchOnly: earn11MonitorsTriggerResearchOnly(),
      closeToClosePromotionBlocked: earningsPromotionBlockedByBarMode('CLOSE_ONLY'),
      exampleTemplateCompiles: compiled.ok,
      grantsExecutionAuthority: false,
    });

    assert.equal(result.marker, HELIOS_EARN11_STRATEGY_RESEARCH_QUALIFIED, result.blockers.join('; '));
  });
});
