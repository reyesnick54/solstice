import { FALSIFICATION_REPORT_SCHEMA, STRESS_CHALLENGER_KINDS } from './taxonomy.ts';
import type {
  FalsificationFinding,
  PerformanceConcentrationAnalysis,
  StrategyFalsificationContext,
  StrategyFalsificationReport,
  StressCampaign,
} from './types.ts';
import { analyzePerformanceConcentration } from './concentration.ts';
import {
  bearStrategyAdversary,
  executionRealityAdversary,
  leakageHunterAdversary,
  overfitHunterAdversary,
  runBullStrategyAgent,
} from './adversarial-agents.ts';
import { buildFragilityAssessment } from './fragility.ts';
import { evaluateFalsificationQualification, MIN_EDGE_SURVIVAL_BPS } from './gates.ts';
import { DEFAULT_STRESS_SENSITIVITY_BPS } from './stress.ts';

function clampSeverity(severity: number): number {
  if (severity < 1) return 1;
  if (severity > 10) return 10;
  return Math.floor(severity);
}

/** One challenge per required kind, severity 5 (neutral mid-range). */
export function buildDefaultStressCampaign(strategyId: string): StressCampaign {
  const challenges = STRESS_CHALLENGER_KINDS.map((kind) =>
    Object.freeze({ kind, severity: 5 }),
  );
  return Object.freeze({
    campaignId: `camp_${strategyId}_evol08`,
    strategyId,
    challenges,
  });
}

function sensitivityFor(
  kind: (typeof STRESS_CHALLENGER_KINDS)[number],
  overrides: StrategyFalsificationContext['stressSensitivityBps'],
): number {
  const fromInput = overrides?.[kind];
  if (typeof fromInput === 'number' && fromInput >= 0) {
    return fromInput;
  }
  return DEFAULT_STRESS_SENSITIVITY_BPS[kind];
}

function applyChallenges(ctx: StrategyFalsificationContext): readonly FalsificationFinding[] {
  const out: FalsificationFinding[] = [];
  let seq = 0;
  for (const challenge of ctx.campaign.challenges) {
    const severity = clampSeverity(challenge.severity);
    const sens = sensitivityFor(challenge.kind, ctx.stressSensitivityBps);
    const loss = sens * severity;
    const edgeRetainedBps = ctx.baselineEdgeBps - loss;
    const falsified = edgeRetainedBps < MIN_EDGE_SURVIVAL_BPS;
    seq += 1;
    out.push(
      Object.freeze({
        findingId: `find_${ctx.strategyId}_${seq}`,
        campaignId: ctx.campaign.campaignId,
        kind: challenge.kind,
        edgeRetainedBps,
        falsified,
        rationale: `Baseline ${ctx.baselineEdgeBps} bps minus ${loss} bps (${sens} bps/pt × severity ${severity}).`,
      }),
    );
  }
  return Object.freeze(out);
}

/**
 * Orchestrates adversarial falsification: stressors, structural checks, and deterministic gates.
 * No agent sets qualification — only `evaluateFalsificationQualification` inside this run.
 */
export class StrategyFalsificationAgent {
  run(ctx: StrategyFalsificationContext): StrategyFalsificationReport {
    const findings = applyChallenges(ctx);
    const concentration: PerformanceConcentrationAnalysis = analyzePerformanceConcentration(
      ctx.strategyId,
      ctx.concentration,
    );
    const fragility = buildFragilityAssessment(ctx);
    const bullCase = runBullStrategyAgent(ctx);

    const adversaries = [
      bearStrategyAdversary,
      leakageHunterAdversary,
      overfitHunterAdversary,
      executionRealityAdversary,
    ] as const;
    const adversaryHypotheses = adversaries.flatMap((a) => [...a.proposeHypotheses(ctx)]);

    const qualification = evaluateFalsificationQualification({
      campaign: ctx.campaign,
      findings,
      fragility,
    });

    return Object.freeze({
      schema: FALSIFICATION_REPORT_SCHEMA,
      strategyId: ctx.strategyId,
      campaign: ctx.campaign,
      findings,
      concentration,
      fragility,
      bullCase,
      adversaryHypotheses: Object.freeze([...adversaryHypotheses]),
      grantsFinancialAuthority: false,
      qualification,
    });
  }
}

export function runStrategyFalsificationSweep(
  ctx: StrategyFalsificationContext,
): StrategyFalsificationReport {
  return new StrategyFalsificationAgent().run(ctx);
}

/** Qualification helper — same as running the agent and reading `qualification.marker`. */
export function evaluateEvol08Qualification(ctx: StrategyFalsificationContext): StrategyFalsificationReport {
  return runStrategyFalsificationSweep(ctx);
}

export { FALSIFICATION_REPORT_SCHEMA };
