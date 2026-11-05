import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { HeliosResearchDataSnapshot } from '../institutional-research-mesh/data-context.ts';
import type { ValuationCommitteeRole } from './taxonomy.ts';
import type {
  CanonicalFinancialFact,
  FrozenValuationEvidencePack,
  ValuationAssumptionChallengeState,
  ValuationSpecialistArtifact,
} from './types.ts';

export type ValuationRoleRunnerInput = {
  readonly role: ValuationCommitteeRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entity: string;
  readonly instrumentId: string;
  readonly objective: string;
  readonly informationTime: UtcInstant;
  readonly data: HeliosResearchDataSnapshot;
  readonly pack: FrozenValuationEvidencePack;
  readonly assumptionChallengeState: ValuationAssumptionChallengeState;
  readonly priorArtifacts: readonly ValuationSpecialistArtifact[];
  readonly challengeMode?: boolean;
};

function artifactId(role: ValuationCommitteeRole, workOrderId: string): string {
  return `val06_${role.toLowerCase()}_${createHash('sha256').update(`${workOrderId}:${role}`).digest('hex').slice(0, 14)}`;
}

function citeFacts(facts: readonly CanonicalFinancialFact[]): readonly string[] {
  return Object.freeze(facts.map((row) => `fact:${row.factId}=${row.valueMinor.toString()}@${row.sourceRef}`));
}

function baseArtifact(
  input: ValuationRoleRunnerInput,
  body: {
    readonly thesis: string;
    readonly supportingEvidence: readonly string[];
    readonly contradictingEvidence: readonly string[];
    readonly challengesIssued?: readonly string[];
    readonly assumptionTopicsChallenged: readonly string[];
    readonly confidence: number;
    readonly uncertainty: string;
  },
): ValuationSpecialistArtifact {
  return Object.freeze({
    artifactId: artifactId(input.role, input.workOrderId),
    role: input.role,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    thesis: body.thesis,
    supportingEvidence: Object.freeze([...body.supportingEvidence]),
    contradictingEvidence: Object.freeze([...body.contradictingEvidence]),
    challengesIssued: Object.freeze([...(body.challengesIssued ?? [])]),
    assumptionTopicsChallenged: Object.freeze([...body.assumptionTopicsChallenged]),
    confidence: body.confidence,
    uncertainty: body.uncertainty,
    informationTime: input.informationTime,
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
  });
}

function distributionHint(state: ValuationAssumptionChallengeState): string {
  const top = [...state.intrinsicValueDistribution].sort(
    (a, b) => b.probability - a.probability,
  )[0];
  return top
    ? `${top.label} ${top.perShareMinor.toString()} minor (${(top.probability * 100).toFixed(0)}%)`
    : 'UNKNOWN';
}

export function runValuationCommitteeRole(input: ValuationRoleRunnerInput): ValuationSpecialistArtifact {
  const scope = `${input.entity} / ${input.instrumentId}`;
  const distHint = distributionHint(input.assumptionChallengeState);
  const freshEvidence = input.data.evidenceBundle.filter((row) => row.freshnessOk);
  const factCitations = citeFacts(input.pack.canonicalFinancialFacts);

  if (input.challengeMode) {
    const contradictions = input.priorArtifacts.flatMap((row) =>
      row.contradictingEvidence.map((line) => `${row.role}: ${line}`),
    );
    return baseArtifact(input, {
      thesis: `${input.role} contradiction pass: challenges prior assumptions without mutating canonical facts.`,
      supportingEvidence: Object.freeze(
        contradictions.length > 0
          ? contradictions.slice(0, 5)
          : ['No unresolved contradictions flagged in prior artifacts.'],
      ),
      contradictingEvidence: Object.freeze([]),
      challengesIssued: Object.freeze(
        contradictions.slice(0, 4).map((line) => `challenge: ${line.slice(0, 160)}`),
      ),
      assumptionTopicsChallenged: Object.freeze(['growth', 'margin', 'WACC', 'terminal']),
      confidence: 0.55,
      uncertainty: 'Medium — structured disagreement capture only; facts remain frozen.',
    });
  }

  switch (input.role) {
    case 'REVENUE_FORECAST':
      return baseArtifact(input, {
        thesis: `Revenue forecast for ${scope}: growth path anchored to frozen canonical revenue facts; challenges unsourced growth lifts.`,
        supportingEvidence: Object.freeze([
          ...factCitations.slice(0, 3),
          ...freshEvidence.map((row) => `evidence:${row.evidenceId}@${row.sourceRef}`).slice(0, 3),
          `Distribution lean: ${distHint}`,
        ]),
        contradictingEvidence: Object.freeze([
          'Segment mix and FX translation not fully decomposed in simulation fixtures',
        ]),
        assumptionTopicsChallenged: Object.freeze(['growth', 'segment economics']),
        confidence: 0.64,
        uncertainty: 'Medium — top-line bridge relies on AAF-certified fundamentals only.',
      });
    case 'MARGIN':
      return baseArtifact(input, {
        thesis: `Margin structure for ${scope}: operating leverage and mix effects read from canonical facts; flags margin expansion without cost evidence.`,
        supportingEvidence: Object.freeze([...factCitations, 'MarginAgent does not rewrite canonical EBITDA or revenue lines']),
        contradictingEvidence: Object.freeze(['Stock-based compensation and restructuring charges are fixture-level only']),
        assumptionTopicsChallenged: Object.freeze(['margin', 'segment economics']),
        confidence: 0.62,
        uncertainty: 'Medium — non-GAAP reconciliation depth limited in simulation.',
      });
    case 'CAPITAL_INTENSITY':
      return baseArtifact(input, {
        thesis: `Capital intensity for ${scope}: reinvestment and working-capital needs vs frozen balance-sheet facts.`,
        supportingEvidence: Object.freeze([
          ...factCitations,
          'Capital requirements derived from entitled HELIOS metadata reads',
        ]),
        contradictingEvidence: Object.freeze(['Maintenance vs growth capex split not live-parsed from filings']),
        assumptionTopicsChallenged: Object.freeze(['capital requirements', 'segment economics']),
        confidence: 0.6,
        uncertainty: 'Medium — capex cadence is scenario placeholder.',
      });
    case 'COST_OF_CAPITAL':
      return baseArtifact(input, {
        thesis: `Cost of capital for ${scope}: WACC band challenged against market-implied discount rate ${input.assumptionChallengeState.impliedWaccBps ?? 'n/a'} bps.`,
        supportingEvidence: Object.freeze([
          input.assumptionChallengeState.impliedWaccBps != null
            ? `Market-implied WACC placeholder: ${input.assumptionChallengeState.impliedWaccBps} bps`
            : 'Implied WACC unavailable — insufficient coverage',
          ...freshEvidence.map((row) => `evidence:${row.evidenceId}`).slice(0, 2),
        ]),
        contradictingEvidence: Object.freeze(['Beta and credit spread term structure are simulation stubs']),
        assumptionTopicsChallenged: Object.freeze(['WACC']),
        confidence: 0.66,
        uncertainty: 'Medium — equity risk premium is policy-supplied in fixtures.',
      });
    case 'DCF_VALUATION':
      return baseArtifact(input, {
        thesis: `DCF valuation for ${scope}: intrinsic bands ${distHint}; terminal value and fade assumptions explicitly cited to evidence.`,
        supportingEvidence: Object.freeze([
          ...factCitations,
          ...input.assumptionChallengeState.intrinsicValueDistribution.map(
            (row) => `${row.label}:${row.perShareMinor.toString()}@${row.probability.toFixed(2)}`,
          ),
        ]),
        contradictingEvidence: Object.freeze(['Mid-cycle normalization not jointly calibrated with macro overlay']),
        assumptionTopicsChallenged: Object.freeze(['growth', 'margin', 'WACC', 'terminal']),
        confidence: 0.68,
        uncertainty: 'Medium — DCF is simulation intelligence; not a price target order.',
      });
    case 'REVERSE_DCF_CHALLENGE':
      return baseArtifact(input, {
        thesis: `Reverse DCF challenge for ${scope}: implied growth ${input.assumptionChallengeState.impliedGrowthBps ?? 'n/a'} bps vs specialist forward path.`,
        supportingEvidence: Object.freeze([
          input.assumptionChallengeState.marketPriceMinor != null
            ? `Market price minor units: ${input.assumptionChallengeState.marketPriceMinor.toString()}`
            : 'Market price missing from snapshot',
          'ReverseDCFChallengeAgent stress-tests terminal and fade embedded in price',
        ]),
        contradictingEvidence: Object.freeze(['Optionality and corporate actions not in reverse DCF grid']),
        assumptionTopicsChallenged: Object.freeze(['growth', 'terminal', 'WACC']),
        confidence: 0.67,
        uncertainty: 'Medium-high — reverse grid is coarse in simulation.',
      });
    case 'COMPARABLE_VALUATION':
      return baseArtifact(input, {
        thesis: `Comparable valuation for ${scope}: peer multiples from universe metadata; challenges multiple expansion without fundamental support.`,
        supportingEvidence: Object.freeze(['Universe instrument metadata consulted via mesh tools']),
        contradictingEvidence: Object.freeze(['Peer set covariance and ADR adjustments not fully specified']),
        assumptionTopicsChallenged: Object.freeze(['margin', 'segment economics']),
        confidence: 0.58,
        uncertainty: 'Medium — comp set is fixture-derived.',
      });
    case 'SOTP':
      return baseArtifact(input, {
        thesis: `Sum-of-the-parts for ${scope}: segment economics valued separately; holding-company discount challenged with evidence.`,
        supportingEvidence: Object.freeze([
          ...factCitations.slice(0, 2),
          'SOTPAgent cites segment revenue facts without mutating canonical totals',
        ]),
        contradictingEvidence: Object.freeze(['Inter-segment eliminations and minority interests are simplified']),
        assumptionTopicsChallenged: Object.freeze(['segment economics', 'capital requirements']),
        confidence: 0.57,
        uncertainty: 'Medium-high — segment disclosure granularity limited.',
      });
    case 'BULL_VALUATION': {
      const supportive = input.priorArtifacts.filter((row) => row.confidence >= 0.58);
      return baseArtifact(input, {
        thesis: `Bull valuation for ${scope}: maximal justified intrinsic path on ${distHint}.`,
        supportingEvidence: Object.freeze(
          supportive.length > 0
            ? supportive.map((row) => `${row.role}: ${row.thesis.slice(0, 100)}`)
            : [`Constructive valuation framing for "${input.objective}".`],
        ),
        contradictingEvidence: Object.freeze(
          input.priorArtifacts
            .flatMap((row) => row.contradictingEvidence)
            .slice(0, 4)
            .map((line) => `bull must overcome: ${line}`),
        ),
        assumptionTopicsChallenged: Object.freeze(['growth', 'terminal']),
        confidence: 0.66,
        uncertainty: 'Medium — advocacy role; seeks maximal intrinsic thesis.',
      });
    }
    case 'BEAR_VALUATION':
      return baseArtifact(input, {
        thesis: `Bear valuation for ${scope}: downside intrinsic path with compressed multiples and higher WACC stress.`,
        supportingEvidence: Object.freeze([
          'Stress path foregrounds fragile assumptions and fixture limitations',
        ]),
        contradictingEvidence: Object.freeze(
          input.priorArtifacts
            .flatMap((row) => row.supportingEvidence)
            .slice(0, 4)
            .map((line) => `bear disputes: ${line}`),
        ),
        assumptionTopicsChallenged: Object.freeze(['margin', 'WACC', 'terminal']),
        confidence: 0.65,
        uncertainty: 'Medium — advocacy role; seeks maximal downside thesis.',
      });
    case 'VALUATION_RISK':
      return baseArtifact(input, {
        thesis: `Valuation risk for ${scope}: model risk, gap risk, and assumption fragility across committee artifacts.`,
        supportingEvidence: Object.freeze(['Risk snapshot and portfolio reads inform tail valuation scenarios']),
        contradictingEvidence: Object.freeze(['Joint factor shocks across DCF and comps not fully specified']),
        assumptionTopicsChallenged: Object.freeze(['WACC', 'terminal', 'capital requirements']),
        confidence: 0.67,
        uncertainty: 'Medium — tail dependence is scenario placeholder.',
      });
    case 'VALUATION_SYNTHESIS': {
      const bull = input.priorArtifacts.find((row) => row.role === 'BULL_VALUATION');
      const bear = input.priorArtifacts.find((row) => row.role === 'BEAR_VALUATION');
      const reverse = input.priorArtifacts.find((row) => row.role === 'REVERSE_DCF_CHALLENGE');
      return baseArtifact(input, {
        thesis: `Valuation synthesis for ${scope}: integrates ${input.priorArtifacts.length} specialist artifacts into ValuationInvestmentThesis inputs.`,
        supportingEvidence: Object.freeze([
          ...(bull ? [`Bull: ${bull.thesis.slice(0, 90)}`] : []),
          ...(reverse ? [`Reverse DCF: ${reverse.thesis.slice(0, 90)}`] : []),
        ]),
        contradictingEvidence: Object.freeze([
          ...(bear ? [`Bear: ${bear.thesis.slice(0, 90)}`] : []),
        ]),
        assumptionTopicsChallenged: Object.freeze(['growth', 'margin', 'WACC', 'terminal']),
        confidence: 0.63,
        uncertainty: 'Medium — synthesis preserves disagreement; no execution authority.',
      });
    }
    default: {
      const _exhaustive: never = input.role;
      return _exhaustive;
    }
  }
}
