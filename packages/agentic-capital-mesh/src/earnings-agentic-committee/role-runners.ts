import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import type { HeliosResearchDataSnapshot } from '../institutional-research-mesh/data-context.ts';
import type { EarningsCommitteeRole } from './taxonomy.ts';
import type { EarningsSpecialistArtifact, ProbabilisticEarningsState } from './types.ts';

export type EarningsRoleRunnerInput = {
  readonly role: EarningsCommitteeRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly entity: string;
  readonly event: string;
  readonly objective: string;
  readonly informationTime: UtcInstant;
  readonly data: HeliosResearchDataSnapshot;
  readonly probabilisticState: ProbabilisticEarningsState;
  readonly priorArtifacts: readonly EarningsSpecialistArtifact[];
  readonly challengeMode?: boolean;
};

function artifactId(role: EarningsCommitteeRole, workOrderId: string): string {
  return `earn10_${role.toLowerCase()}_${createHash('sha256').update(`${workOrderId}:${role}`).digest('hex').slice(0, 14)}`;
}

function baseArtifact(
  input: EarningsRoleRunnerInput,
  body: {
    readonly thesis: string;
    readonly supportingEvidence: readonly string[];
    readonly contradictingEvidence: readonly string[];
    readonly challengesIssued?: readonly string[];
    readonly confidence: number;
    readonly uncertainty: string;
  },
): EarningsSpecialistArtifact {
  return Object.freeze({
    artifactId: artifactId(input.role, input.workOrderId),
    role: input.role,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    thesis: body.thesis,
    supportingEvidence: Object.freeze([...body.supportingEvidence]),
    contradictingEvidence: Object.freeze([...body.contradictingEvidence]),
    challengesIssued: Object.freeze([...(body.challengesIssued ?? [])]),
    confidence: body.confidence,
    uncertainty: body.uncertainty,
    informationTime: input.informationTime,
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
  });
}

function beatLabel(state: ProbabilisticEarningsState): string {
  const top = [...state.beatProbabilities].sort((a, b) => b.probability - a.probability)[0];
  return top ? `${top.label} (${(top.probability * 100).toFixed(0)}%)` : 'UNKNOWN';
}

export function runEarningsCommitteeRole(input: EarningsRoleRunnerInput): EarningsSpecialistArtifact {
  const scope = `${input.entity} / ${input.event}`;
  const beatHint = beatLabel(input.probabilisticState);
  const freshEvidence = input.data.evidenceBundle.filter((row) => row.freshnessOk);

  if (input.challengeMode) {
    const contradictions = input.priorArtifacts.flatMap((row) =>
      row.contradictingEvidence.map((line) => `${row.role}: ${line}`),
    );
    return baseArtifact(input, {
      thesis: `${input.role} challenge pass: surfaces contradictions without mutating frozen evidence.`,
      supportingEvidence: Object.freeze(
        contradictions.length > 0
          ? contradictions.slice(0, 5)
          : ['No unresolved contradictions flagged in prior artifacts.'],
      ),
      contradictingEvidence: Object.freeze([]),
      challengesIssued: Object.freeze(
        contradictions.slice(0, 3).map((line) => `challenge: ${line.slice(0, 160)}`),
      ),
      confidence: 0.55,
      uncertainty: 'Medium — challenge pass is structured disagreement capture only.',
    });
  }

  switch (input.role) {
    case 'HARD_FINANCIALS':
      return baseArtifact(input, {
        thesis: `Hard financials for ${scope}: revenue, margin, and cash conversion from entitled HELIOS fixtures only.`,
        supportingEvidence: Object.freeze([
          `Probabilistic beat lean: ${beatHint}`,
          'Instrument metadata and mandate reads via mesh tools',
        ]),
        contradictingEvidence: Object.freeze(['No live vendor EPS actuals in simulation path']),
        confidence: 0.64,
        uncertainty: 'Medium — restatement and segment disclosure gaps in fixtures.',
      });
    case 'ANALYST_EXPECTATIONS':
      return baseArtifact(input, {
        thesis: `Street expectations for ${scope}: consensus direction vs probabilistic state.`,
        supportingEvidence: Object.freeze([
          `Guidance band: ${input.probabilisticState.guidanceProbabilities.map((row) => row.label).join(', ')}`,
        ]),
        contradictingEvidence: Object.freeze(['Whisper and revision breadth not populated in simulation']),
        confidence: 0.58,
        uncertainty: 'High — estimate dispersion not modeled.',
      });
    case 'TRANSCRIPT_INTELLIGENCE':
      return baseArtifact(input, {
        thesis: `Transcript tone and Q&A risk for ${scope} from provenance-tagged evidence only.`,
        supportingEvidence: Object.freeze(
          freshEvidence.map((row) => `evidence:${row.evidenceId}@${row.sourceRef}`),
        ),
        contradictingEvidence: Object.freeze(['No NLP over full call audio; text fixtures only']),
        confidence: 0.52,
        uncertainty: 'High — management hedging language not scored live.',
      });
    case 'EARNINGS_QUALITY':
      return baseArtifact(input, {
        thesis: `Earnings quality for ${scope}: accruals, cash conversion, and one-time items.`,
        supportingEvidence: Object.freeze(['Quality heuristics applied to sandbox fundamental envelope']),
        contradictingEvidence: Object.freeze(['Footnote-level adjustments not fully parsed']),
        confidence: 0.6,
        uncertainty: 'Medium — non-GAAP reconciliation depth limited.',
      });
    case 'OPTIONS_EARNINGS':
      return baseArtifact(input, {
        thesis: `Options-implied move for ${scope}: convexity context without live chain pulls.`,
        supportingEvidence: Object.freeze([
          input.probabilisticState.impliedMoveBps != null
            ? `Implied move placeholder: ${input.probabilisticState.impliedMoveBps} bps`
            : 'Implied move unavailable — insufficient coverage',
        ]),
        contradictingEvidence: Object.freeze(['Listed options chain not ingested in simulation']),
        confidence: 0.48,
        uncertainty: 'High — skew and term structure are placeholders.',
      });
    case 'PEER_READ_THROUGH':
      return baseArtifact(input, {
        thesis: `Peer read-through for ${scope}: sector earnings correlation from universe metadata.`,
        supportingEvidence: Object.freeze(['Universe instrument classes consulted for peer basket']),
        contradictingEvidence: Object.freeze(['No cross-ticker EPS covariance matrix in fixtures']),
        confidence: 0.56,
        uncertainty: 'Medium — peer mapping may omit ADR and spin-off structures.',
      });
    case 'MACRO_CONTEXT':
      return baseArtifact(input, {
        thesis: `Macro context for ${scope}: rates, FX, and demand regime via RDT and mandate reads.`,
        supportingEvidence: Object.freeze(['Macro overlay is simulation-grade, not live FRED']),
        contradictingEvidence: Object.freeze(['Policy shock paths not jointly calibrated with issuer guide']),
        confidence: 0.57,
        uncertainty: 'Medium — macro beta to issuer guidance is approximate.',
      });
    case 'BULL_EARNINGS': {
      const supportive = input.priorArtifacts.filter((row) => row.confidence >= 0.55);
      return baseArtifact(input, {
        thesis: `Bull case for ${scope}: strongest constructive path on ${beatHint} with upside drivers.`,
        supportingEvidence: Object.freeze(
          supportive.length > 0
            ? supportive.map((row) => `${row.role}: ${row.thesis.slice(0, 100)}`)
            : [`Constructive framing for "${input.objective}" under simulation evidence.`],
        ),
        contradictingEvidence: Object.freeze(
          input.priorArtifacts
            .flatMap((row) => row.contradictingEvidence)
            .slice(0, 4)
            .map((line) => `bull must overcome: ${line}`),
        ),
        confidence: 0.66,
        uncertainty: 'Medium — advocacy role; seeks maximal positive thesis.',
      });
    }
    case 'BEAR_EARNINGS':
      return baseArtifact(input, {
        thesis: `Bear case for ${scope}: miss path, guide cut, and multiple compression narrative.`,
        supportingEvidence: Object.freeze([
          'Stress path foregrounds stale or unentitled evidence and fixture limitations',
        ]),
        contradictingEvidence: Object.freeze(
          input.priorArtifacts
            .flatMap((row) => row.supportingEvidence)
            .slice(0, 4)
            .map((line) => `bear disputes: ${line}`),
        ),
        confidence: 0.65,
        uncertainty: 'Medium — advocacy role; seeks maximal negative thesis.',
      });
    case 'FORENSIC_ACCOUNTING':
      return baseArtifact(input, {
        thesis: `Forensic accounting review for ${scope}: revenue recognition, DSO, and non-GAAP bridges.`,
        supportingEvidence: Object.freeze([
          'Accounting quality attack surface documented; no ledger or authority mutations',
        ]),
        contradictingEvidence: Object.freeze([
          'Auditor opinion and late-filing flags not wired to live EDGAR in this path',
        ]),
        confidence: 0.62,
        uncertainty: 'Medium — forensic signals are heuristic in simulation.',
      });
    case 'RISK_EARNINGS':
      return baseArtifact(input, {
        thesis: `Tail risks for ${scope}: gap risk, liquidity, mandate breach, and post-print drift.`,
        supportingEvidence: Object.freeze(['Risk snapshot and portfolio reads inform tail scenarios']),
        contradictingEvidence: Object.freeze(['Joint tail dependence across peers not fully specified']),
        confidence: 0.67,
        uncertainty: 'Medium — gap distribution is scenario placeholder.',
      });
    case 'EARNINGS_SYNTHESIS': {
      const bull = input.priorArtifacts.find((row) => row.role === 'BULL_EARNINGS');
      const bear = input.priorArtifacts.find((row) => row.role === 'BEAR_EARNINGS');
      const forensic = input.priorArtifacts.find((row) => row.role === 'FORENSIC_ACCOUNTING');
      const risk = input.priorArtifacts.find((row) => row.role === 'RISK_EARNINGS');
      return baseArtifact(input, {
        thesis: `Earnings synthesis for ${scope}: integrates ${input.priorArtifacts.length} committee artifacts into structured thesis.`,
        supportingEvidence: Object.freeze([
          ...(bull ? [`Bull: ${bull.thesis.slice(0, 90)}`] : []),
          ...(forensic ? [`Forensic: ${forensic.thesis.slice(0, 90)}`] : []),
        ]),
        contradictingEvidence: Object.freeze([
          ...(bear ? [`Bear: ${bear.thesis.slice(0, 90)}`] : []),
          ...(risk ? [`Risk: ${risk.thesis.slice(0, 90)}`] : []),
        ]),
        confidence: 0.63,
        uncertainty: 'Medium — synthesis preserves disagreement; not execution authority.',
      });
    }
    default: {
      const _exhaustive: never = input.role;
      return _exhaustive;
    }
  }
}
