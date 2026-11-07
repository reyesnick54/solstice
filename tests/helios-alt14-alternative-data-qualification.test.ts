/**
 * HELIOS ALT14 — alternative-data intelligence final qualification.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { buildEvol12SampleGenomeProposal } from '../packages/strategy-lab/src/evol12/fixtures.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  AAF_CERTIFIED_ALT_FEATURE_IDS,
  ALT14_ADVERSARIAL_SCENARIO_IDS,
  HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED,
  SKEPTIC_ALT_ATTACK_VECTORS,
  assertNoRawProviderRecordsInGenome,
  assertEvol12MayProposeAlternativeFeatures,
  compileAltStrategyGenomeFeatures,
  demoAlternativeDataResearchState,
  evaluateAlternativeDataIntelligenceQualification,
  listAltWorkPackages,
  runAllAlt14AdversarialScenarios,
} from '../packages/platform/src/helios/alternative-data-intelligence/index.ts';
import { linkAltResearchToCounterfactualAssessment } from '../packages/platform/src/helios/alternative-data-intelligence/alt13-counterfactual-bridge.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-07T09:00:00.000Z');
const ROOT = process.cwd();

describe('HELIOS ALT14 — alternative-data intelligence qualification', () => {
  it('architecture guard: alternative-data-intelligence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) =>
      row.file.includes('helios/alternative-data-intelligence'),
    );
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation only', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    const mapPath = join(ROOT, 'docs/productization/sunrey-authority-map.json');
    const freezePath = join(ROOT, 'docs/productization/sunrey-architecture-freeze.json');
    assert.ok(existsSync(mapPath));
    assert.ok(existsSync(freezePath));
    const map = JSON.parse(readFileSync(mapPath, 'utf8')) as {
      productionPosture?: { production_authorized?: boolean };
    };
    const freeze = JSON.parse(readFileSync(freezePath, 'utf8')) as {
      productionPosture?: { production_authorized?: boolean };
    };
    assert.equal(map.productionPosture?.production_authorized, false);
    assert.equal(freeze.productionPosture?.production_authorized, false);
  });

  it('lists ALT01–ALT14 as IMPLEMENTED', () => {
    const workPackages = listAltWorkPackages(ROOT);
    assert.ok(workPackages.every((row) => row.status === 'IMPLEMENTED'));
    assert.equal(workPackages.length, 14);
  });

  it('required alternative-data docs exist', () => {
    const docs = [
      'docs/helios/alternative-data/HELIOS_ALTERNATIVE_DATA_FINAL_REPORT.md',
      'docs/helios/alternative-data/ALTERNATIVE_DATA_CAPABILITY_MATRIX.md',
      'docs/helios/alternative-data/ALTERNATIVE_DATA_SIGNAL_VALIDATION.md',
      'docs/helios/alternative-data/ALTERNATIVE_DATA_PROVIDER_RISK.md',
      'docs/helios/alternative-data/ALTERNATIVE_DATA_ENTITY_MAPPING_AUDIT.md',
    ];
    for (const doc of docs) {
      assert.ok(existsSync(join(ROOT, doc)), doc);
    }
  });

  it('covers skeptic attack vectors and AAF-certified feature ids', () => {
    assert.equal(SKEPTIC_ALT_ATTACK_VECTORS.length, 11);
    assert.equal(AAF_CERTIFIED_ALT_FEATURE_IDS.length, 8);
  });

  it('passes all fourteen adversarial qualification scenarios', () => {
    const rows = runAllAlt14AdversarialScenarios();
    assert.equal(rows.length, ALT14_ADVERSARIAL_SCENARIO_IDS.length);
    assert.ok(rows.every((row) => row.passed), rows.filter((r) => !r.passed).map((r) => r.scenarioId).join(', '));
  });

  it('exposes only AAF-certified features to Strategy Genome', () => {
    const state = demoAlternativeDataResearchState();
    assert.equal(state.grantsExecutionAuthority, false);
    assert.equal(state.researchEvidenceOnly, true);
    const features = compileAltStrategyGenomeFeatures(state);
    assert.ok(features.length > 0);
    assert.equal(assertNoRawProviderRecordsInGenome(features), true);
    for (const row of features) {
      assert.ok(AAF_CERTIFIED_ALT_FEATURE_IDS.includes(row.featureId));
    }
  });

  it('EVOL12 may propose alternative-feature hypotheses; CF bridge is advisory', () => {
    const proposal = buildEvol12SampleGenomeProposal();
    proposal.rationale.requiredFeatures;
    const altProposal = Object.freeze({
      ...proposal,
      rationale: Object.freeze({
        ...proposal.rationale,
        requiredFeatures: Object.freeze([
          ...proposal.rationale.requiredFeatures,
          'feature.alt.workforce_expansion_state',
        ]),
      }),
    });
    assert.equal(assertEvol12MayProposeAlternativeFeatures(altProposal), true);
    const cfRef = linkAltResearchToCounterfactualAssessment({
      policyLabel: 'alt_informed_policy_fixture',
      evidenceRef: 'ev/alt14/demo_state',
    });
    assert.equal(cfRef.simulationOnly, true);
  });

  it('qualifies ALT14 with marker HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED', () => {
    const qualification = evaluateAlternativeDataIntelligenceQualification({
      root: ROOT,
      gitSha: 'alt14_qualify_sha',
      evaluatedAt: NOW,
    });
    assert.equal(qualification.qualified, true, qualification.blockers.join('; '));
    assert.equal(qualification.marker, HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_V1_QUALIFIED);
    assert.equal(qualification.adversarialScenariosPassed, 14);
  });
});
