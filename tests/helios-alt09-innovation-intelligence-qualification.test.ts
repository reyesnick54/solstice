/**
 * HELIOS ALT09 — patent, technology, and commercialization intelligence qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED,
  ALT09_FIXTURE_AS_OF,
  FIXTURE_COMPANY_SIM_LABS,
  FIXTURE_UNPUBLISHED_APPLICATION,
  assertNoPatentLeakage,
  buildInnovationIntelligenceForCompany,
  evaluateAlt09InnovationIntelligenceQualification,
  filterKnowablePatents,
  ingestPatentsFromWave6,
  runAlt09InnovationIntelligencePipeline,
} from '../packages/platform/src/helios/alternative-data-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = process.cwd();

describe('HELIOS ALT09 — innovation intelligence', () => {
  it('architecture guard: alternative-data-intelligence stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) =>
      row.file.includes('helios/alternative-data-intelligence'),
    );
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('production safety: simulation only', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('rejects unpublished patent applications before publication (PIT)', () => {
    const beforePublication = asUtcInstant('2024-01-01T00:00:00.000Z');
    const visible = filterKnowablePatents(beforePublication, [FIXTURE_UNPUBLISHED_APPLICATION]);
    assert.equal(visible.length, 0);
    assert.throws(() => assertNoPatentLeakage(beforePublication, [FIXTURE_UNPUBLISHED_APPLICATION]));
  });

  it('upgrades Wave 6 patent search into company-level observations', () => {
    const rows = ingestPatentsFromWave6({ evaluationTimeUtc: ALT09_FIXTURE_AS_OF });
    assert.ok(rows.length >= 1);
    assert.ok(rows.every((row) => row.knowableAt && row.publicationDate));
    assert.equal(rows.every((row) => row.grantsInfringementConclusion), false);
  });

  it('builds portfolio, graph, features, and commercialization states', () => {
    const built = buildInnovationIntelligenceForCompany({
      companyId: FIXTURE_COMPANY_SIM_LABS,
      companyLabel: 'SunRey Simulation Labs',
      asOf: ALT09_FIXTURE_AS_OF,
    });
    const f = built.innovationState.quality.features;
    assert.ok(f.patentCount >= 1);
    assert.ok(f.familyCount >= 1);
    assert.ok(built.innovationState.portfolio.embeddings.length >= 1);
    assert.ok(built.technologyGraph.edges.some((e) => e.kind === 'PATENT_LINKED_TO_PRODUCT'));
    const util = built.innovationState.commercialization.patentUtilization.find(
      (row) => row.patentId === 'US-20240123456-A1',
    );
    assert.equal(util?.utilizationClass, 'LIKELY_UTILIZED');
    assert.equal(util?.inferredFromGrantOnly, false);
  });

  it('runs ALT09 pipeline and qualifies HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED', () => {
    const pipeline = runAlt09InnovationIntelligencePipeline();
    const failed = pipeline.stages.filter((row) => !row.ok);
    assert.equal(failed.length, 0, JSON.stringify(failed));
    assert.equal(pipeline.knowableAtViolations, 0);

    const qualification = evaluateAlt09InnovationIntelligenceQualification();
    assert.equal(
      qualification.marker,
      HELIOS_ALT09_INNOVATION_INTELLIGENCE_QUALIFIED,
      qualification.blockers.join('; '),
    );
    assert.equal(qualification.qualified, true);
  });
});
