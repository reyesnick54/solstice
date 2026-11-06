import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import { sourceRefsFromEvidence, type HeliosResearchDataSnapshot } from '../institutional-research-mesh/data-context.ts';
import {
  COUNTERFACTUAL_CF13_QUESTIONS,
  SKEPTIC_CF13_ATTACK_VECTORS,
  type CounterfactualCf13Artifact,
  type CounterfactualCf13Role,
  type Cf13ThesisExtraction,
  type CounterfactualAlternativeSpec,
  type EstimatorResultSummary,
  type DistributionalResultSummary,
  type ExecutionResultSummary,
} from './types.ts';

type RoleRunnerInput = {
  readonly role: CounterfactualCf13Role;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly informationTime: UtcInstant;
  readonly data: HeliosResearchDataSnapshot;
  readonly factualPolicyHint?: string;
  readonly priorArtifacts: readonly CounterfactualCf13Artifact[];
};

function artifactId(role: CounterfactualCf13Role, workOrderId: string): string {
  return `cf13_${role.toLowerCase()}_${createHash('sha256').update(`${workOrderId}:${role}`).digest('hex').slice(0, 14)}`;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
}

function buildAlternatives(objective: string): readonly CounterfactualAlternativeSpec[] {
  const base = slug(objective) || 'scenario';
  return Object.freeze([
    {
      id: `alt_${base}_enter`,
      label: 'Immediate entry (counterfactual)',
      description: 'Hypothesis: HELIOS enters at the first policy-eligible instant with baseline size.',
      addressesQuestion: COUNTERFACTUAL_CF13_QUESTIONS[0]!,
    },
    {
      id: `alt_${base}_wait`,
      label: 'Delayed entry (counterfactual)',
      description: 'Hypothesis: HELIOS defers until additional confirmation signals from the same observation fabric.',
      addressesQuestion: COUNTERFACTUAL_CF13_QUESTIONS[1]!,
    },
    {
      id: `alt_${base}_size_down`,
      label: 'Reduced size (counterfactual)',
      description: 'Hypothesis: same directional view with smaller notional to bound market impact.',
      addressesQuestion: COUNTERFACTUAL_CF13_QUESTIONS[2]!,
    },
    {
      id: `alt_${base}_exec_twap`,
      label: 'Different execution style (counterfactual)',
      description: 'Hypothesis: time-weighted or passive working style versus a single aggressive print.',
      addressesQuestion: COUNTERFACTUAL_CF13_QUESTIONS[3]!,
    },
    {
      id: `alt_${base}_noop`,
      label: 'No trade (counterfactual)',
      description: 'Hypothesis: maintain prior portfolio posture without the contemplated HELIOS action.',
      addressesQuestion: COUNTERFACTUAL_CF13_QUESTIONS[4]!,
    },
    {
      id: `alt_${base}_replace_incumbent`,
      label: 'Replace incumbent strategy sleeve (counterfactual)',
      description: 'Hypothesis: substitute the active rule driving the legacy exposure with the HELIOS policy.',
      addressesQuestion: COUNTERFACTUAL_CF13_QUESTIONS[5]!,
    },
  ]);
}

function estimatorRowsFor(alternatives: readonly CounterfactualAlternativeSpec[]): readonly EstimatorResultSummary[] {
  return Object.freeze(
    alternatives.map((alt, i) =>
      Object.freeze({
        alternativeId: alt.id,
        estimatorFamily: i % 2 === 0 ? 'doubly_robust_sandbox' : 'matching_sandbox',
        pointEstimateMinor: null,
        intervalNote: 'Wide — overlap and support sets not audited against production history.',
        interpretationNote:
          'Point null by design: committee refuses a numeric pretend-realized counterfactual without audited identification.',
      }),
    ),
  );
}

function distributionalRowsFor(alternatives: readonly CounterfactualAlternativeSpec[]): readonly DistributionalResultSummary[] {
  return Object.freeze(
    alternatives.map((alt) =>
      Object.freeze({
        alternativeId: alt.id,
        summary: `Scenario fan for ${alt.label}: spread driven by fixture volatility and execution slippage priors only.`,
        simulationOnly: true as const,
      }),
    ),
  );
}

function executionRowsFor(alternatives: readonly CounterfactualAlternativeSpec[]): readonly ExecutionResultSummary[] {
  return Object.freeze(
    alternatives.map((alt) =>
      Object.freeze({
        alternativeId: alt.id,
        assumptions: Object.freeze([
          'Venue liquidity from getMarketSnapshot only',
          'No live order book reconstruction',
        ]),
        feasibilityNote: 'Executable in principle under simulation; production feasibility not asserted.',
      }),
    ),
  );
}

function baseArtifact(
  input: RoleRunnerInput,
  body: {
    readonly thesis: string;
    readonly supportingEvidence: readonly string[];
    readonly contradictingEvidence: readonly string[];
    readonly confidence: number;
    readonly uncertainty: string;
    readonly counterfactualQuestionsAddressed: readonly (typeof COUNTERFACTUAL_CF13_QUESTIONS)[number][];
    readonly skepticAttacksConsidered: readonly (typeof SKEPTIC_CF13_ATTACK_VECTORS)[number][];
    readonly extraction: Cf13ThesisExtraction | null;
  },
): CounterfactualCf13Artifact {
  return Object.freeze({
    artifactId: artifactId(input.role, input.workOrderId),
    role: input.role,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    thesis: body.thesis,
    supportingEvidence: Object.freeze([...body.supportingEvidence]),
    contradictingEvidence: Object.freeze([...body.contradictingEvidence]),
    counterfactualQuestionsAddressed: Object.freeze([...body.counterfactualQuestionsAddressed]),
    skepticAttacksConsidered: Object.freeze([...body.skepticAttacksConsidered]),
    confidence: body.confidence,
    uncertainty: body.uncertainty,
    informationTime: input.informationTime,
    extraction: body.extraction,
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
  });
}

export function runCounterfactualCf13Role(input: RoleRunnerInput): CounterfactualCf13Artifact {
  const portfolio = input.data.reads.getPortfolio;
  const market = input.data.reads.getMarketSnapshot;
  const mandate = input.data.reads.getMandate;
  const factualLabel = input.factualPolicyHint ?? 'factual_path_from_context';

  const evidenceLine = sourceRefsFromEvidence(input.data.evidenceBundle);
  const alternatives = buildAlternatives(input.objective);

  switch (input.role) {
    case 'COUNTERFACTUAL_POLICY': {
      return baseArtifact(input, {
        thesis: `Frame counterfactuals for "${input.objective}" against factual policy "${factualLabel}" using HELIOS observation bundle only; no single-model answer is authoritative.`,
        supportingEvidence: Object.freeze([
          `Evidence refs: ${evidenceLine.length} envelope(s)`,
          mandate ? 'Mandate read via getMandate' : 'Mandate missing — policy constraints underspecified',
        ]),
        contradictingEvidence: Object.freeze(['Counterfactual labels do not replay history']),
        confidence: 0.72,
        uncertainty: 'Medium — policy scope depends on mandate completeness',
        counterfactualQuestionsAddressed: Object.freeze([...COUNTERFACTUAL_CF13_QUESTIONS]),
        skepticAttacksConsidered: Object.freeze([]),
        extraction: Object.freeze({
          factualOutcomeFragment: `Factual outcome path recorded as "${factualLabel}" with portfolio snapshot ${portfolio ? 'present' : 'absent'}.`,
          alternatives,
          contradictions: Object.freeze(['Different agents may assign different overlap to the same alternative label']),
        }),
      });
    }
    case 'OUTCOME_MODEL': {
      return baseArtifact(input, {
        thesis: `Outcome models compare factual vs candidate policies under sandbox moments; they never emit a definite dollar counterfactual (see CF13 language guard).`,
        supportingEvidence: Object.freeze([
          market ? 'Market snapshot available for moment checks' : 'No market snapshot — outcome moments weakened',
        ]),
        contradictingEvidence: Object.freeze(['No fitted outcome surface — extrapolation risk']),
        confidence: 0.58,
        uncertainty: 'High — model class agnostic here; only structural warnings emitted',
        counterfactualQuestionsAddressed: Object.freeze([
          COUNTERFACTUAL_CF13_QUESTIONS[0]!,
          COUNTERFACTUAL_CF13_QUESTIONS[1]!,
          COUNTERFACTUAL_CF13_QUESTIONS[4]!,
        ]),
        skepticAttacksConsidered: Object.freeze([]),
        extraction: Object.freeze({
          distributionalRows: distributionalRowsFor(alternatives),
          contradictions: Object.freeze(['Outcome model disagrees with raw narrative if regime shifts']),
        }),
      });
    }
    case 'PROPENSITY_SUPPORT': {
      const overlapOk = evidenceLine.length >= 2 && mandate !== undefined;
      return baseArtifact(input, {
        thesis: `Propensity support scores whether treated vs control regions share mass; poor overlap blocks strong causal claims.`,
        supportingEvidence: Object.freeze([overlapOk ? 'Multiple evidence envelopes + mandate context' : 'Sparse support for overlap testing']),
        contradictingEvidence: Object.freeze(['True propensity surface not estimated in this path']),
        confidence: overlapOk ? 0.55 : 0.4,
        uncertainty: 'High — calibration not validated',
        counterfactualQuestionsAddressed: Object.freeze([
          COUNTERFACTUAL_CF13_QUESTIONS[0]!,
          COUNTERFACTUAL_CF13_QUESTIONS[1]!,
          COUNTERFACTUAL_CF13_QUESTIONS[2]!,
        ]),
        skepticAttacksConsidered: Object.freeze([]),
        extraction: Object.freeze({
          supportDiagnostics: Object.freeze([
            {
              topic: 'overlap',
              status: overlapOk ? ('PASS' as const) : ('WARN' as const),
              detail: overlapOk ? 'Multiple envelopes suggest some common support' : 'Limited envelopes — overlap uncertain',
            },
            {
              topic: 'propensity.calibration',
              status: 'WARN' as const,
              detail: 'No holdout calibration curve in simulation',
            },
          ]),
        }),
      });
    }
    case 'EXECUTION_REALITY': {
      return baseArtifact(input, {
        thesis: `Execution counterfactuals vary style and timing; market impact stays hypothetical without microstructure replay.`,
        supportingEvidence: Object.freeze(['Mesh tools expose portfolio and mandate, not live depth']),
        contradictingEvidence: Object.freeze(['Market impact models not fitted']),
        confidence: 0.5,
        uncertainty: 'High — slippage priors only',
        counterfactualQuestionsAddressed: Object.freeze([
          COUNTERFACTUAL_CF13_QUESTIONS[2]!,
          COUNTERFACTUAL_CF13_QUESTIONS[3]!,
        ]),
        skepticAttacksConsidered: Object.freeze([]),
        extraction: Object.freeze({
          executionRows: executionRowsFor(alternatives),
        }),
      });
    }
    case 'CAUSAL_INFERENCE': {
      const classification =
        evidenceLine.length >= 2 && mandate ? ('WEAK_SUPPORT' as const) : ('AMBIGUOUS' as const);
      return baseArtifact(input, {
        thesis: `Causal read: identification hinges on stable assignment and overlap; ${classification === 'WEAK_SUPPORT' ? 'weak support' : 'ambiguous'} in current envelope.`,
        supportingEvidence: Object.freeze([`Classification ${classification}`]),
        contradictingEvidence: Object.freeze(['No IV or RD design asserted']),
        confidence: 0.47,
        uncertainty: 'High — causal support is provisional',
        counterfactualQuestionsAddressed: Object.freeze([
          COUNTERFACTUAL_CF13_QUESTIONS[0]!,
          COUNTERFACTUAL_CF13_QUESTIONS[5]!,
        ]),
        skepticAttacksConsidered: Object.freeze([]),
        extraction: Object.freeze({
          causalSupportClassification: classification,
        }),
      });
    }
    case 'PORTFOLIO_PATH': {
      return baseArtifact(input, {
        thesis: `Portfolio path analysis maps each alternative to cash and risk budget without promising a path PnL.`,
        supportingEvidence: Object.freeze([
          portfolio ? 'Portfolio snapshot available' : 'Portfolio snapshot missing',
        ]),
        contradictingEvidence: Object.freeze(['Path dependence across funding and margin not modeled']),
        confidence: 0.52,
        uncertainty: 'Medium — sequence risk not enumerated',
        counterfactualQuestionsAddressed: Object.freeze([
          COUNTERFACTUAL_CF13_QUESTIONS[2]!,
          COUNTERFACTUAL_CF13_QUESTIONS[4]!,
          COUNTERFACTUAL_CF13_QUESTIONS[5]!,
        ]),
        skepticAttacksConsidered: Object.freeze([]),
        extraction: Object.freeze({
          contradictions: Object.freeze(['Path narratives may conflict with single-period outcome summaries']),
        }),
      });
    }
    case 'RISK_COUNTERFACTUAL': {
      return baseArtifact(input, {
        thesis: `Risk counterfactuals stress tail and concentration under each alternative; still simulation labels only.`,
        supportingEvidence: Object.freeze(['getRiskSnapshot informs tail posture when present']),
        contradictingEvidence: Object.freeze(['Joint tail dependence not reconstructed']),
        confidence: 0.49,
        uncertainty: 'High — tail co-movement underspecified',
        counterfactualQuestionsAddressed: Object.freeze([...COUNTERFACTUAL_CF13_QUESTIONS]),
        skepticAttacksConsidered: Object.freeze([]),
        extraction: Object.freeze({
          supportDiagnostics: Object.freeze([
            {
              topic: 'risk.regime',
              status: 'WARN' as const,
              detail: 'Regime shift can invalidate static risk loads',
            },
          ]),
        }),
      });
    }
    case 'SKEPTIC': {
      return baseArtifact(input, {
        thesis: `Adversarial review: enumerate overlap, calibration, extrapolation, regime, execution, impact, selection, and hindsight failures; refuse any "definite earnings" sentence.`,
        supportingEvidence: Object.freeze(['Structured attack vectors required by CF13']),
        contradictingEvidence: Object.freeze(['None — skeptic role is critique-first']),
        confidence: 0.41,
        uncertainty: 'High — attack surface is conservative',
        counterfactualQuestionsAddressed: Object.freeze([...COUNTERFACTUAL_CF13_QUESTIONS]),
        skepticAttacksConsidered: Object.freeze([...SKEPTIC_CF13_ATTACK_VECTORS]),
        extraction: Object.freeze({
          uncertaintyFragment:
            'Overlap and calibration uncertain; extrapolation and regime shift can invert ordering; execution and impact assumptions are brittle; selection and hindsight bias contaminate narrative baselines.',
          contradictions: Object.freeze([
            'Policy agent optimism vs propensity overlap warnings',
            'Outcome fan vs execution feasibility under thin liquidity',
          ]),
          supportDiagnostics: Object.freeze(
            SKEPTIC_CF13_ATTACK_VECTORS.map((v) =>
              Object.freeze({
                topic: `skeptic.${v.replace(/\s+/g, '_')}`,
                status: 'WARN' as const,
                detail: `Stress: ${v}`,
              }),
            ),
          ),
        }),
      });
    }
    case 'COUNTERFACTUAL_SYNTHESIS': {
      return baseArtifact(input, {
        thesis: `Synthesis merges committee outputs into CounterfactualResearchThesis without certifying realized counterfactual PnL.`,
        supportingEvidence: Object.freeze([`Prior artifact count ${input.priorArtifacts.length}`]),
        contradictingEvidence: Object.freeze(['Residual model disagreement not auto-resolved']),
        confidence: 0.45,
        uncertainty: 'High — synthesis is an epistemic summary',
        counterfactualQuestionsAddressed: Object.freeze([...COUNTERFACTUAL_CF13_QUESTIONS]),
        skepticAttacksConsidered: Object.freeze([]),
        extraction: Object.freeze({
          factualOutcomeFragment:
            input.priorArtifacts.find((a) => a.role === 'COUNTERFACTUAL_POLICY')?.extraction?.factualOutcomeFragment ??
            `Factual policy "${factualLabel}" with mesh reads only.`,
          alternatives,
          estimatorRows: estimatorRowsFor(alternatives),
          distributionalRows: distributionalRowsFor(alternatives),
          executionRows: executionRowsFor(alternatives),
          conclusionFragment:
            'Treat alternatives as labeled scenarios with null point estimates unless identification is audited; prioritize skeptic diagnostics before policy imitation.',
          uncertaintyFragment:
            'Epistemic uncertainty dominates; any ranking is fragile to overlap and regime assumptions.',
        }),
      });
    }
    default: {
      const _exhaustive: never = input.role;
      return _exhaustive;
    }
  }
}
