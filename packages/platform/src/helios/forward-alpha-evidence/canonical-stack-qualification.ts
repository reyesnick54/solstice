/**
 * ALPHA16 — invoke canonical ALPHA01–ALPHA14 qualification harnesses (no evidence-plane stubs).
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';

import { assertChronologicalForwardRecord, HELIOS_ALPHA01_EVIDENCE_DOMAIN } from './alpha01-evidence-domain.ts';
import { CANONICAL_ALPHA_MODULES, type CanonicalAlphaModuleRow } from './canonical-alpha-modules.ts';
import { runAlpha03PrequentialHarness } from '../forward-alpha/alpha03/harness.ts';
import { evaluateAlpha05BenchmarkAttributionQualification } from '../forward-alpha/alpha05/qualification.ts';
import {
  ALPHA07_FIXTURE_BOUNDS,
  ALPHA07_FIXTURE_OBSERVATIONS,
  evaluateAlpha07SequentialEvidenceQualification,
  evaluateSequentialAlphaEvidence,
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED,
} from '../forward-alpha/alpha07-sequential-evidence/index.ts';
import { evaluateAlpha11Qualification } from '../forward-alpha/alpha11/qualification.ts';

export type CanonicalAlphaQualificationRow = {
  readonly packageId: string;
  readonly implementationOwner: string;
  readonly marker: string;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

function rowFromResult(
  meta: CanonicalAlphaModuleRow,
  marker: string,
  qualified: boolean,
  blockers: readonly string[],
): CanonicalAlphaQualificationRow {
  return Object.freeze({
    packageId: meta.packageId,
    implementationOwner: meta.implementationOwner,
    marker,
    qualified,
    blockers: Object.freeze([...blockers]),
  });
}

function qualifyAlpha01(): CanonicalAlphaQualificationRow {
  const meta = CANONICAL_ALPHA_MODULES.find((r) => r.packageId === 'ALPHA01')!;
  const blockers: string[] = [];
  try {
    assertChronologicalForwardRecord({
      decisionId: 'fwd-alpha:fixture@2026-11-08T12:00:00.000Z#0',
      recordedAt: asUtcInstant('2026-11-08T12:00:00.000Z'),
      knowableAt: asUtcInstant('2026-11-08T12:00:00.000Z'),
      action: 'HOLD',
      notionalMinor: 0n,
      benchmarkId: 'BMK_FIXTURE',
      sourceKind: 'SYNTHETIC_HARNESS',
    });
  } catch (error: unknown) {
    blockers.push(error instanceof Error ? error.message : String(error));
  }
  return rowFromResult(meta, HELIOS_ALPHA01_EVIDENCE_DOMAIN, blockers.length === 0, blockers);
}

function qualifyAlpha03(): CanonicalAlphaQualificationRow {
  const meta = CANONICAL_ALPHA_MODULES.find((r) => r.packageId === 'ALPHA03')!;
  const harness = runAlpha03PrequentialHarness();
  return rowFromResult(meta, harness.marker, harness.qualified, harness.blockers);
}

function qualifyAlpha05(root: string, gitSha: string, evaluatedAt: UtcInstant): CanonicalAlphaQualificationRow {
  const meta = CANONICAL_ALPHA_MODULES.find((r) => r.packageId === 'ALPHA05')!;
  const result = evaluateAlpha05BenchmarkAttributionQualification({ root, gitSha, evaluatedAt });
  return rowFromResult(meta, result.marker, result.qualified, result.blockers);
}

function qualifyAlpha07(evaluatedAt: UtcInstant): CanonicalAlphaQualificationRow {
  const meta = CANONICAL_ALPHA_MODULES.find((r) => r.packageId === 'ALPHA07')!;
  const evidence = evaluateSequentialAlphaEvidence({
    config: {
      campaignId: 'alpha16-stack',
      bounds: ALPHA07_FIXTURE_BOUNDS,
      subjectId: 'MODEL_A',
      benchmarkId: 'BMK_SPY',
      confidenceAlpha: 0.05,
    },
    observations: ALPHA07_FIXTURE_OBSERVATIONS,
    evaluatedAt,
  });
  const gate = evaluateAlpha07SequentialEvidenceQualification({
    evidence,
    boundsPredeclared: true,
    offlineDiagnosticsPresent: evidence.offlineDiagnostics.note.length > 0,
  });
  return rowFromResult(meta, gate.marker, gate.qualified, gate.blockers);
}

function qualifyAlpha11(): CanonicalAlphaQualificationRow {
  const meta = CANONICAL_ALPHA_MODULES.find((r) => r.packageId === 'ALPHA11')!;
  const result = evaluateAlpha11Qualification();
  return rowFromResult(meta, result.marker, result.qualified, result.qualified ? [] : ['detector_qualification_failed']);
}

export function runCanonicalAlphaStackQualification(input: {
  readonly root: string;
  readonly gitSha: string;
  readonly evaluatedAt: UtcInstant;
}): readonly CanonicalAlphaQualificationRow[] {
  return Object.freeze([
    qualifyAlpha01(),
    qualifyAlpha03(),
    qualifyAlpha05(input.root, input.gitSha, input.evaluatedAt),
    qualifyAlpha07(input.evaluatedAt),
    qualifyAlpha11(),
  ]);
}

export function alpha07StackSmokeQualified(rows: readonly CanonicalAlphaQualificationRow[]): boolean {
  const row = rows.find((r) => r.packageId === 'ALPHA07');
  return row?.marker === HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED;
}
