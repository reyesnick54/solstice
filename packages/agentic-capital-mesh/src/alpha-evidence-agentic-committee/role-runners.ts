import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import {
  sourceRefsFromEvidence,
  type HeliosResearchDataSnapshot,
} from '../institutional-research-mesh/data-context.ts';
import {
  ALPHA14_EVIDENCE_QUESTIONS,
  SKEPTIC_ALPHA14_ATTACK_VECTORS,
  type Alpha14CommitteeRole,
} from './taxonomy.ts';
import type {
  Alpha14CommitteeArtifact,
  Alpha14ThesisExtraction,
  AlphaPerformanceClaimEnvelope,
} from './types.ts';

export type Alpha14RoleRunnerInput = {
  readonly role: Alpha14CommitteeRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly strategyRef: string;
  readonly objective: string;
  readonly informationTime: UtcInstant;
  readonly data: HeliosResearchDataSnapshot;
  readonly performanceClaim: AlphaPerformanceClaimEnvelope;
  readonly priorArtifacts: readonly Alpha14CommitteeArtifact[];
};

function artifactId(role: Alpha14CommitteeRole, workOrderId: string): string {
  return `alpha14_${role.toLowerCase()}_${createHash('sha256').update(`${workOrderId}:${role}`).digest('hex').slice(0, 14)}`;
}

function baseArtifact(
  input: Alpha14RoleRunnerInput,
  body: {
    readonly thesis: string;
    readonly supportingEvidence: readonly string[];
    readonly contradictingEvidence: readonly string[];
    readonly questionsAddressed: readonly (typeof ALPHA14_EVIDENCE_QUESTIONS)[number][];
    readonly skepticAttacksConsidered?: readonly (typeof SKEPTIC_ALPHA14_ATTACK_VECTORS)[number][];
    readonly seeksRejection?: boolean;
    readonly confidence: number;
    readonly uncertainty: string;
    readonly extraction: Alpha14ThesisExtraction | null;
  },
): Alpha14CommitteeArtifact {
  const isSkeptic = ['STATISTICAL_SKEPTIC', 'MULTIPLE_TESTING_AUDITOR', 'COUNTERFACTUAL_SKEPTIC'].includes(
    input.role,
  );
  return Object.freeze({
    artifactId: artifactId(input.role, input.workOrderId),
    role: input.role,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    thesis: body.thesis,
    supportingEvidence: Object.freeze([...body.supportingEvidence]),
    contradictingEvidence: Object.freeze([...body.contradictingEvidence]),
    questionsAddressed: Object.freeze([...body.questionsAddressed]),
    skepticAttacksConsidered: Object.freeze([...(body.skepticAttacksConsidered ?? [])]),
    seeksRejection: body.seeksRejection ?? isSkeptic,
    confidence: body.confidence,
    uncertainty: body.uncertainty,
    informationTime: input.informationTime,
    extraction: body.extraction,
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
    activatesCapital: false as const,
  });
}

export function runAlpha14CommitteeRole(input: Alpha14RoleRunnerInput): Alpha14CommitteeArtifact {
  const claim = input.performanceClaim;
  const evidenceLine = sourceRefsFromEvidence(input.data.evidenceBundle);
  const freshCount = input.data.evidenceBundle.filter((row) => row.freshnessOk && row.entitlementOk).length;
  const windowShort = claim.observationWindowDays < 90;
  const manyTrials = claim.independentTrialCount > 50;

  switch (input.role) {
    case 'FORWARD_PERFORMANCE':
      return baseArtifact(input, {
        thesis: `Forward performance review for ${claim.strategyRef}: observed window ${claim.observationWindowDays}d; claim "${claim.performanceClaimSummary}" is treated as hypothesis until benchmark, cost, and trial-count audits complete.`,
        supportingEvidence: Object.freeze([
          `claimId:${claim.claimId}`,
          `entitled evidence envelopes: ${freshCount}`,
          ...evidenceLine.slice(0, 3),
        ]),
        contradictingEvidence: Object.freeze(
          windowShort ? ['Observation window may be too short for stable inference'] : ['Full live path not replayed'],
        ),
        questionsAddressed: Object.freeze([
          ALPHA14_EVIDENCE_QUESTIONS[0]!,
          ALPHA14_EVIDENCE_QUESTIONS[7]!,
        ]),
        confidence: windowShort ? 0.42 : 0.55,
        uncertainty: 'Medium — forward labels are simulation envelopes only.',
        extraction: Object.freeze({
          supportedClaims:
            freshCount >= 2 && !windowShort
              ? Object.freeze(['Point-in-time evidence pack ties claim to entitled observations'])
              : Object.freeze([]),
          unsupportedClaims: Object.freeze(
            windowShort ? ['Evidence duration insufficient for durable performance claim'] : [],
          ),
        }),
      });
    case 'BENCHMARK':
      return baseArtifact(input, {
        thesis: `Benchmark-relative test: claimed benchmark-relative=${claim.benchmarkRelativeClaimed}; without matched passive/control sleeve, excess return is ambiguous.`,
        supportingEvidence: Object.freeze([
          claim.benchmarkRelativeClaimed
            ? 'Proponent asserts benchmark-relative edge'
            : 'No benchmark-relative framing in claim envelope',
        ]),
        contradictingEvidence: Object.freeze([
          'Factor and style exposures not fully decomposed in simulation path',
          'Custom benchmark selection bias possible',
        ]),
        questionsAddressed: Object.freeze([ALPHA14_EVIDENCE_QUESTIONS[1]!]),
        skepticAttacksConsidered: Object.freeze(['benchmark mismatch']),
        confidence: claim.benchmarkRelativeClaimed ? 0.48 : 0.4,
        uncertainty: 'High — benchmark parity not certified here.',
        extraction: Object.freeze({
          statisticalEvidence: Object.freeze({
            domain: 'benchmark',
            status: claim.benchmarkRelativeClaimed ? 'WARN' : 'UNKNOWN',
            summary: claim.benchmarkRelativeClaimed
              ? 'Relative claim stated; independent benchmark audit pending'
              : 'Absolute performance narrative without control',
            detailRefs: Object.freeze([`strategy:${claim.strategyRef}`]),
          }),
        }),
      });
    case 'STATISTICAL_SKEPTIC':
      return baseArtifact(input, {
        thesis: `Statistical skeptic: default reject unless leakage, power, and stability checks pass; seek reasons to reject claim ${claim.claimId}.`,
        supportingEvidence: Object.freeze(['Structured reject-first mandate for ALPHA14']),
        contradictingEvidence: Object.freeze([
          windowShort ? 'Short window inflates significance' : 'Stability across sub-windows not shown',
          manyTrials ? 'Trial count suggests search pressure' : 'Effect size may be noise',
          'No holdout seal independent of selection',
        ]),
        questionsAddressed: Object.freeze([
          ALPHA14_EVIDENCE_QUESTIONS[0]!,
          ALPHA14_EVIDENCE_QUESTIONS[6]!,
          ALPHA14_EVIDENCE_QUESTIONS[7]!,
        ]),
        skepticAttacksConsidered: Object.freeze([
          'in-sample overfit',
          'lookahead or leakage',
          'multiple-testing inflation',
          'short sample window',
          'data snooping',
        ]),
        seeksRejection: true,
        confidence: 0.38,
        uncertainty: 'High — skeptic does not upgrade evidence status.',
        extraction: Object.freeze({
          rejectReasons: Object.freeze([
            'Reject until out-of-sample and trial-count adjusted inference provided',
          ]),
          limitations: Object.freeze(['No authority to alter statistical gates']),
        }),
      });
    case 'MULTIPLE_TESTING_AUDITOR':
      return baseArtifact(input, {
        thesis: `Multiple-testing audit: independentTrialCount=${claim.independentTrialCount}; selection from many trials can manufacture apparent edge.`,
        supportingEvidence: Object.freeze([
          manyTrials
            ? 'High trial count flags search multiplicity'
            : 'Moderate trial count — multiplicity risk not eliminated',
        ]),
        contradictingEvidence: Object.freeze([
          manyTrials
            ? 'Family-wise error control not evidenced'
            : 'Trial genealogy may be incomplete',
        ]),
        questionsAddressed: Object.freeze([ALPHA14_EVIDENCE_QUESTIONS[6]!]),
        skepticAttacksConsidered: Object.freeze([
          'multiple-testing inflation',
          'data snooping',
          'in-sample overfit',
          'short sample window',
        ]),
        seeksRejection: true,
        confidence: manyTrials ? 0.35 : 0.45,
        uncertainty: 'High — deflated significance metrics not attached.',
        extraction: Object.freeze({
          statisticalEvidence: Object.freeze({
            domain: 'multiple_testing',
            status: manyTrials ? 'FAIL' : 'WARN',
            summary: manyTrials
              ? 'Trial count suggests strategy may be selected from too many attempts'
              : 'Trial count moderate; document full search tree',
            detailRefs: Object.freeze([`trials:${claim.independentTrialCount}`]),
          }),
          unsupportedClaims: Object.freeze(
            manyTrials ? ['Apparent edge may be multiple-testing artifact'] : [],
          ),
        }),
      });
    case 'EXECUTION_REALITY':
      return baseArtifact(input, {
        thesis: `Execution reality: assumption ref ${claim.executionAssumptionRef}; optimistic fills can manufacture paper alpha.`,
        supportingEvidence: Object.freeze([
          claim.costsModeled ? 'Costs flagged as modeled in claim envelope' : 'Costs not marked modeled',
        ]),
        contradictingEvidence: Object.freeze([
          'Microstructure replay absent',
          'Latency and partial-fill paths not bound',
        ]),
        questionsAddressed: Object.freeze([
          ALPHA14_EVIDENCE_QUESTIONS[4]!,
          ALPHA14_EVIDENCE_QUESTIONS[5]!,
        ]),
        skepticAttacksConsidered: Object.freeze(['fill model too optimistic', 'cost model too optimistic']),
        confidence: 0.46,
        uncertainty: 'High — execution twin not asserted as production-identical.',
        extraction: Object.freeze({
          implementationEvidence: Object.freeze({
            domain: 'execution',
            status: claim.costsModeled ? 'WARN' : 'FAIL',
            summary: claim.costsModeled
              ? 'Execution and costs modeled in simulation; live slippage unverified'
              : 'Transaction costs may erase reported edge',
            detailRefs: Object.freeze([claim.executionAssumptionRef]),
          }),
        }),
      });
    case 'REGIME_ROBUSTNESS':
      return baseArtifact(input, {
        thesis: `Regime robustness: dominant tag ${claim.dominantRegimeTag ?? 'unset'}; edge dependent on one regime remains unsupported for upgrade.`,
        supportingEvidence: Object.freeze([
          claim.dominantRegimeTag ? `Dominant regime tag ${claim.dominantRegimeTag}` : 'No regime tag in envelope',
        ]),
        contradictingEvidence: Object.freeze([
          claim.dominantRegimeTag
            ? 'Performance may concentrate in a single regime bucket'
            : 'Regime breakdown not provided',
        ]),
        questionsAddressed: Object.freeze([ALPHA14_EVIDENCE_QUESTIONS[3]!]),
        skepticAttacksConsidered: Object.freeze(['single-regime dominance']),
        confidence: 0.44,
        uncertainty: 'Medium — regime labels are simulation taxonomy only.',
        extraction: Object.freeze({
          regimeEvidence: Object.freeze({
            domain: 'regime',
            status: claim.dominantRegimeTag ? 'WARN' : 'UNKNOWN',
            summary: claim.dominantRegimeTag
              ? 'Claim may be regime-dependent'
              : 'Regime homogeneity not demonstrated',
            detailRefs: Object.freeze(claim.dominantRegimeTag ? [claim.dominantRegimeTag] : []),
          }),
        }),
      });
    case 'CAPACITY':
      return baseArtifact(input, {
        thesis: `Capacity review for ${claim.strategyRef}: scalabilityClaimed=${claim.scalabilityClaimed}; capacity cliff can erase scalable edge.`,
        supportingEvidence: Object.freeze([
          claim.scalabilityClaimed ? 'Proponent claims scalable edge' : 'Scalability not asserted',
        ]),
        contradictingEvidence: Object.freeze(['Market impact at target AUM not evidenced']),
        questionsAddressed: Object.freeze([ALPHA14_EVIDENCE_QUESTIONS[8]!]),
        skepticAttacksConsidered: Object.freeze(['capacity cliff']),
        confidence: 0.47,
        uncertainty: 'High — ADV/participation limits not modeled live.',
        extraction: Object.freeze({
          capacityEvidence: Object.freeze({
            domain: 'capacity',
            status: claim.scalabilityClaimed ? 'WARN' : 'UNKNOWN',
            summary: claim.scalabilityClaimed
              ? 'Scalability claimed without capacity stress evidence'
              : 'Scalability unknown',
            detailRefs: Object.freeze([`strategy:${claim.strategyRef}`]),
          }),
        }),
      });
    case 'DATA_INTEGRITY':
      return baseArtifact(input, {
        thesis: `Data integrity: ${freshCount} fresh entitled envelopes; leakage or stale joins can create false performance.`,
        supportingEvidence: Object.freeze([
          ...evidenceLine.slice(0, 4),
          freshCount >= 2 ? 'Multiple entitled envelopes' : 'Sparse entitled envelopes',
        ]),
        contradictingEvidence: Object.freeze([
          freshCount < 2 ? 'Insufficient entitled evidence for integrity attestation' : 'Point-in-time seal only',
        ]),
        questionsAddressed: Object.freeze([ALPHA14_EVIDENCE_QUESTIONS[0]!]),
        skepticAttacksConsidered: Object.freeze(['lookahead or leakage', 'survivorship in universe']),
        confidence: freshCount >= 2 ? 0.52 : 0.4,
        uncertainty: 'Medium — vendor reconciliation not exhaustive.',
        extraction: Object.freeze({
          contradictions: Object.freeze(
            freshCount < 2 ? ['Sparse evidence vs strong performance narrative'] : [],
          ),
        }),
      });
    case 'ALPHA_DECAY':
      return baseArtifact(input, {
        thesis: `Alpha decay monitor: decaySignalClaimed=${claim.decaySignalClaimed}; recent deterioration blocks upgrade.`,
        supportingEvidence: Object.freeze([
          claim.decaySignalClaimed ? 'Decay signal present in claim envelope' : 'No decay signal reported',
        ]),
        contradictingEvidence: Object.freeze([
          claim.decaySignalClaimed
            ? 'Decay trend suggests edge may be eroding'
            : 'Decay not measured across rolling windows',
        ]),
        questionsAddressed: Object.freeze([ALPHA14_EVIDENCE_QUESTIONS[9]!]),
        skepticAttacksConsidered: Object.freeze(['alpha decay trend']),
        confidence: 0.43,
        uncertainty: 'Medium — decay metrics are simulation labels.',
        extraction: Object.freeze({
          unsupportedClaims: Object.freeze(
            claim.decaySignalClaimed ? ['Edge may have begun decaying'] : [],
          ),
        }),
      });
    case 'COUNTERFACTUAL_SKEPTIC':
      return baseArtifact(input, {
        thesis: `Counterfactual skeptic: if execution, benchmark, or regime differed, apparent edge may vanish; reject upgrade absent stress proofs.`,
        supportingEvidence: Object.freeze(
          input.priorArtifacts.flatMap((row) => row.contradictingEvidence).slice(0, 5),
        ),
        contradictingEvidence: Object.freeze([
          'Benchmark swap could remove excess',
          'Higher costs could zero net edge',
          'Alternate regime mix could flip sign',
        ]),
        questionsAddressed: Object.freeze([...ALPHA14_EVIDENCE_QUESTIONS]),
        skepticAttacksConsidered: Object.freeze([...SKEPTIC_ALPHA14_ATTACK_VECTORS]),
        seeksRejection: true,
        confidence: 0.36,
        uncertainty: 'High — counterfactual stress is conservative by design.',
        extraction: Object.freeze({
          rejectReasons: Object.freeze(['Withhold evidence upgrade until counterfactual stress pack attached']),
          contradictions: Object.freeze(
            input.priorArtifacts.flatMap((row) => row.contradictingEvidence).slice(0, 8),
          ),
        }),
      });
    case 'ALPHA_EVIDENCE_SYNTHESIS':
      return baseArtifact(input, {
        thesis: `Alpha evidence synthesis for ${claim.strategyRef}: aggregates specialist artifacts; research-only output with no capital activation.`,
        supportingEvidence: Object.freeze(
          input.priorArtifacts.map((row) => `${row.role}:${row.thesis.slice(0, 80)}`).slice(0, 6),
        ),
        contradictingEvidence: Object.freeze(
          input.priorArtifacts.flatMap((row) => row.contradictingEvidence).slice(0, 6),
        ),
        questionsAddressed: Object.freeze([...ALPHA14_EVIDENCE_QUESTIONS]),
        skepticAttacksConsidered: Object.freeze([]),
        seeksRejection: false,
        confidence: 0.5,
        uncertainty: 'Synthesis is research output only; no evidence-status upgrade issued.',
        extraction: Object.freeze({
          recommendedNextEvidence: Object.freeze([
            'Independent holdout with sealed selection log',
            'Benchmark-matched control with factor exposures',
            'Execution twin with conservative fill and fee models',
            'Regime-stratified performance table',
            'Capacity curve at target participation',
            'Trial-count adjusted significance report',
          ]),
        }),
      });
    default: {
      const _exhaustive: never = input.role;
      throw new Error(`unknown ALPHA14 role ${String(_exhaustive)}`);
    }
  }
}
