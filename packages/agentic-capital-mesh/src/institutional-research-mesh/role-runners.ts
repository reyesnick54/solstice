import { createHash } from 'node:crypto';

import type { UtcInstant } from '../imports.ts';
import { sourceRefsFromEvidence, type HeliosResearchDataSnapshot } from './data-context.ts';
import type {
  InstitutionalResearchRole,
  ResearchRecommendationClass,
  ResearchTimeHorizon,
  StructuredResearchArtifact,
} from './types.ts';

type RoleRunnerInput = {
  readonly role: InstitutionalResearchRole;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly informationTime: UtcInstant;
  readonly data: HeliosResearchDataSnapshot;
  readonly instrumentHints: readonly string[];
  readonly regimeHints: readonly string[];
  readonly priorArtifacts: readonly StructuredResearchArtifact[];
};

function artifactId(role: InstitutionalResearchRole, workOrderId: string): string {
  return `ira_${role.toLowerCase()}_${createHash('sha256').update(`${workOrderId}:${role}`).digest('hex').slice(0, 16)}`;
}

function baseArtifact(input: RoleRunnerInput, body: {
  readonly thesis: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly confidence: number;
  readonly uncertainty: string;
  readonly timeHorizon: ResearchTimeHorizon;
  readonly recommendationClass: ResearchRecommendationClass;
  readonly toolsUsed: readonly string[];
  readonly knownLimitations?: readonly string[];
}): StructuredResearchArtifact {
  const instruments =
    input.instrumentHints.length > 0
      ? input.instrumentHints
      : Object.freeze(['SIM-UNIVERSE'] as const);
  const regimes =
    input.regimeHints.length > 0 ? input.regimeHints : Object.freeze(['SIMULATION_REGIME'] as const);
  return Object.freeze({
    artifactId: artifactId(input.role, input.workOrderId),
    role: input.role,
    workOrderId: input.workOrderId,
    subjectId: input.subjectId,
    thesis: body.thesis,
    supportingEvidence: Object.freeze([...body.supportingEvidence]),
    contradictingEvidence: Object.freeze([...body.contradictingEvidence]),
    confidence: body.confidence,
    uncertainty: body.uncertainty,
    timeHorizon: body.timeHorizon,
    applicableInstruments: Object.freeze([...instruments]),
    applicableRegimes: Object.freeze([...regimes]),
    sourceRefs: Object.freeze(
      sourceRefsFromEvidence(input.data.evidenceBundle).map((row) =>
        Object.freeze({
          sourceRef: row.sourceRef,
          evidenceId: row.evidenceId,
          sourceKind: row.sourceKind,
          informationTime: row.informationTime,
        }),
      ),
    ),
    informationTime: input.informationTime,
    knownLimitations: Object.freeze(
      body.knownLimitations ?? [
        'Simulation-only fixture data; no live vendor or chain feeds in this path.',
        'Research output is not an order, allocation, or Execution Authority.',
      ],
    ),
    recommendationClass: body.recommendationClass,
    toolsUsed: Object.freeze([...body.toolsUsed]),
    grantsFinancialAuthority: false as const,
    issuesOrders: false as const,
  });
}

function countRecommendation(
  artifacts: readonly StructuredResearchArtifact[],
  cls: ResearchRecommendationClass,
): number {
  return artifacts.filter((row) => row.recommendationClass === cls).length;
}

export function runInstitutionalResearchRole(input: RoleRunnerInput): StructuredResearchArtifact {
  const market = input.data.reads.getMarketSnapshot;
  const portfolio = input.data.reads.getPortfolio;
  const mandate = input.data.reads.getMandate;
  const rdt = input.data.reads.getRdtReadiness;

  switch (input.role) {
    case 'FUNDAMENTAL_RESEARCH':
      return baseArtifact(input, {
        thesis: `Fundamental lens on "${input.objective}": valuation and balance-sheet quality assessed from approved HELIOS metadata only.`,
        supportingEvidence: Object.freeze([
          'Instrument metadata read via getInstrumentMetadata',
          'Mandate compatibility checked via getMandate',
        ]),
        contradictingEvidence: Object.freeze(['No live SEC EDGAR ingestion; fixture fundamentals only.']),
        confidence: 0.62,
        uncertainty: 'Medium — corporate actions and restatements not modeled in simulation.',
        timeHorizon: 'MONTHS_3_12',
        recommendationClass: mandate ? 'RESEARCH_SUPPORTS' : 'NEEDS_MORE_INFORMATION',
        toolsUsed: Object.freeze(['getInstrumentMetadata', 'getMandate', 'getMarketSnapshot']),
      });
    case 'EARNINGS_RESEARCH':
      return baseArtifact(input, {
        thesis: `Earnings trajectory for "${input.objective}" inferred from sandbox observation envelopes, not vendor EPS feeds.`,
        supportingEvidence: Object.freeze(['Evidence bundle carries observation timestamps and provenance refs']),
        contradictingEvidence: Object.freeze(['No whisper numbers or management guidance channel in simulation']),
        confidence: 0.55,
        uncertainty: 'High — earnings surprise distribution not populated.',
        timeHorizon: 'WEEKS_1_4',
        recommendationClass: input.data.evidenceBundle.some((row) => row.freshnessOk)
          ? 'INCONCLUSIVE'
          : 'NEEDS_MORE_INFORMATION',
        toolsUsed: Object.freeze(['getMarketSnapshot', 'getInstrumentMetadata']),
      });
    case 'TECHNICAL_RESEARCH':
      return baseArtifact(input, {
        thesis: `Price/volume structure for "${input.objective}" reviewed against HELIOS market snapshot fixtures.`,
        supportingEvidence: Object.freeze([
          market ? 'Market snapshot available for pattern context' : 'Objective scoped without snapshot',
        ]),
        contradictingEvidence: Object.freeze(['No intraday tape; delayed/end-of-day simulation classes only']),
        confidence: 0.58,
        uncertainty: 'Medium — indicator parameters not calibrated to live liquidity.',
        timeHorizon: 'DAYS_1_5',
        recommendationClass: market ? 'RESEARCH_SUPPORTS' : 'NEEDS_MORE_INFORMATION',
        toolsUsed: Object.freeze(['getMarketSnapshot']),
      });
    case 'MACRO_RESEARCH':
      return baseArtifact(input, {
        thesis: `Macro/Fx regime framing for "${input.objective}" uses mandate and RDT readiness reads, not live FRED pulls.`,
        supportingEvidence: Object.freeze([
          rdt ? `RDT state consulted (${JSON.stringify(rdt).slice(0, 80)}…)` : 'RDT read attempted',
        ]),
        contradictingEvidence: Object.freeze(['Cross-asset stress scenarios are simulation placeholders']),
        confidence: 0.6,
        uncertainty: 'Medium — policy path and term-premium shocks not simulated live.',
        timeHorizon: 'MONTHS_1_3',
        recommendationClass: 'INCONCLUSIVE',
        toolsUsed: Object.freeze(['getRdtReadiness', 'getMarketSnapshot', 'getMandate']),
      });
    case 'NEWS_RESEARCH':
      return baseArtifact(input, {
        thesis: `Headline and event risk scan for "${input.objective}" limited to entitled, provenance-tagged evidence.`,
        supportingEvidence: Object.freeze(
          input.data.evidenceBundle.map((row) => `evidence:${row.evidenceId}@${row.sourceRef}`),
        ),
        contradictingEvidence: Object.freeze(['No unbounded web crawl; external_public requires entitlement']),
        confidence: 0.57,
        uncertainty: 'Medium — event clustering not run across full news graph.',
        timeHorizon: 'DAYS_1_5',
        recommendationClass: input.data.evidenceBundle.every((row) => row.entitlementOk)
          ? 'RESEARCH_SUPPORTS'
          : 'RESEARCH_OPPOSES',
        toolsUsed: Object.freeze(['getMarketSnapshot']),
      });
    case 'SENTIMENT_RESEARCH':
      return baseArtifact(input, {
        thesis: `Crowd and positioning sentiment for "${input.objective}" is advisory only; no social API calls.`,
        supportingEvidence: Object.freeze(['Sentiment inferred from simulation fixtures and PEVE snapshot if present']),
        contradictingEvidence: Object.freeze(['Retail flow and social volume not wired in simulation']),
        confidence: 0.5,
        uncertainty: 'High — sentiment can mean-revert faster than research horizon.',
        timeHorizon: 'DAYS_1_5',
        recommendationClass: 'INCONCLUSIVE',
        toolsUsed: Object.freeze(['getEconomicValueSnapshot', 'getMarketSnapshot']),
      });
    case 'OPTIONS_RESEARCH':
      return baseArtifact(input, {
        thesis: `Vol surface and convexity context for "${input.objective}" — portfolio greeks not computed live.`,
        supportingEvidence: Object.freeze(['Risk snapshot consulted for budget context']),
        contradictingEvidence: Object.freeze(['No listed options chain ingestion in this simulation path']),
        confidence: 0.48,
        uncertainty: 'High — skew and term structure are placeholders.',
        timeHorizon: 'WEEKS_1_4',
        recommendationClass: 'NEEDS_MORE_INFORMATION',
        toolsUsed: Object.freeze(['getRiskSnapshot', 'getMarketSnapshot']),
      });
    case 'FLOW_RESEARCH':
      return baseArtifact(input, {
        thesis: `Institutional flow and positioning proxies for "${input.objective}" derived from portfolio and market reads.`,
        supportingEvidence: Object.freeze([
          portfolio ? 'Portfolio holdings context loaded' : 'Portfolio read returned empty fixture',
        ]),
        contradictingEvidence: Object.freeze(['No 13F or dark-pool tape; flow is heuristic only']),
        confidence: 0.54,
        uncertainty: 'Medium — flow signals are noisy near month-end windows.',
        timeHorizon: 'WEEKS_1_4',
        recommendationClass: portfolio ? 'INCONCLUSIVE' : 'NEEDS_MORE_INFORMATION',
        toolsUsed: Object.freeze(['getPortfolio', 'getMarketSnapshot']),
      });
    case 'CRYPTO_ONCHAIN_RESEARCH':
      return baseArtifact(input, {
        thesis: `On-chain activity read for "${input.objective}" stays behind HELIOS crypto market-data fixtures; no RPC calls.`,
        supportingEvidence: Object.freeze(['Universe metadata may include crypto instrument classes when entitled']),
        contradictingEvidence: Object.freeze(['Wallet clustering and mempool telemetry not available in simulation']),
        confidence: 0.52,
        uncertainty: 'High — chain reorganizations and bridge flows not modeled.',
        timeHorizon: 'DAYS_1_5',
        recommendationClass: 'NEEDS_MORE_INFORMATION',
        toolsUsed: Object.freeze(['getInstrumentMetadata', 'getMarketSnapshot']),
      });
    case 'BULL_RESEARCH': {
      const supportive = input.priorArtifacts.filter((row) => row.recommendationClass === 'RESEARCH_SUPPORTS');
      const supportiveLines =
        supportive.length > 0
          ? supportive.map((row) => `${row.role}: ${row.thesis.slice(0, 120)}`)
          : [`No prior RESEARCH_SUPPORTS signals; bull case relies on objective framing for "${input.objective}".`];
      return baseArtifact(input, {
        thesis: `Bull case for "${input.objective}": ${supportive.length} upstream analyst artifacts lean supportive.`,
        supportingEvidence: Object.freeze(supportiveLines),
        contradictingEvidence: Object.freeze(
          input.priorArtifacts
            .filter((row) => row.recommendationClass === 'RESEARCH_OPPOSES')
            .map((row) => `${row.role}: opposing signal`),
        ),
        confidence: 0.63,
        uncertainty: 'Medium — advocacy role; not independent verification.',
        timeHorizon: 'MONTHS_1_3',
        recommendationClass: supportive.length >= 2 ? 'RESEARCH_SUPPORTS' : 'INCONCLUSIVE',
        toolsUsed: Object.freeze([]),
      });
    }
    case 'BEAR_RESEARCH': {
      const opposed = input.priorArtifacts.filter((row) => row.recommendationClass === 'RESEARCH_OPPOSES');
      const bearLines =
        opposed.length > 0
          ? opposed.map((row) => `${row.role}: ${row.thesis.slice(0, 120)}`)
          : [`No prior RESEARCH_OPPOSES signals; bear case highlights simulation limitations for "${input.objective}".`];
      return baseArtifact(input, {
        thesis: `Bear case for "${input.objective}": stress paths and invalidating evidence foregrounded.`,
        supportingEvidence: Object.freeze(bearLines),
        contradictingEvidence: Object.freeze(
          input.priorArtifacts
            .filter((row) => row.recommendationClass === 'RESEARCH_SUPPORTS')
            .map((row) => `${row.role}: supportive signal`),
        ),
        confidence: 0.61,
        uncertainty: 'Medium — advocacy role; seeks disconfirming evidence.',
        timeHorizon: 'MONTHS_1_3',
        recommendationClass: opposed.length > 0 ? 'RESEARCH_OPPOSES' : 'INCONCLUSIVE',
        toolsUsed: Object.freeze([]),
      });
    }
    case 'RISK_RESEARCH':
      return baseArtifact(input, {
        thesis: `Risk review for "${input.objective}": mandate, risk budget, and tail scenarios — no risk limit mutations.`,
        supportingEvidence: Object.freeze(['getRiskSnapshot and getMandate consulted; research-only path']),
        contradictingEvidence: Object.freeze([
          'Concentration and liquidity gaps may be understated in fixtures',
        ]),
        confidence: 0.66,
        uncertainty: 'Medium — joint tail dependence not fully specified.',
        timeHorizon: 'MONTHS_1_3',
        recommendationClass:
          input.priorArtifacts.some((row) => row.recommendationClass === 'RESEARCH_OPPOSES')
            ? 'RESEARCH_OPPOSES'
            : 'INCONCLUSIVE',
        toolsUsed: Object.freeze(['getRiskSnapshot', 'getMandate', 'getPortfolio']),
      });
    case 'EXECUTION_RESEARCH':
      return baseArtifact(input, {
        thesis: `Execution quality research for "${input.objective}": route, timing, and impact — explicitly not an order.`,
        supportingEvidence: Object.freeze([
          'Microstructure and portfolio reads inform simulation router notes',
          'issuesOrders=false enforced at artifact schema',
        ]),
        contradictingEvidence: Object.freeze(['No broker smart-router keys; tactics remain paper/simulation only']),
        confidence: 0.59,
        uncertainty: 'Medium — impact models are not calibrated to live venues.',
        timeHorizon: 'INTRADAY',
        recommendationClass: 'INCONCLUSIVE',
        toolsUsed: Object.freeze(['getMarketSnapshot', 'getPortfolio', 'getInstrumentMetadata']),
        knownLimitations: Object.freeze([
          'ExecutionResearchAgent never submits orders or requests Execution Authority.',
          'Simulation-only smart-router candidate.',
        ]),
      });
    case 'RESEARCH_SYNTHESIS': {
      const supports = countRecommendation(input.priorArtifacts, 'RESEARCH_SUPPORTS');
      const opposes = countRecommendation(input.priorArtifacts, 'RESEARCH_OPPOSES');
      const needs = countRecommendation(input.priorArtifacts, 'NEEDS_MORE_INFORMATION');
      let recommendationClass: ResearchRecommendationClass = 'INCONCLUSIVE';
      if (needs >= 3) recommendationClass = 'NEEDS_MORE_INFORMATION';
      else if (supports > opposes + 1) recommendationClass = 'RESEARCH_SUPPORTS';
      else if (opposes > supports + 1) recommendationClass = 'RESEARCH_OPPOSES';

      const bull = input.priorArtifacts.find((row) => row.role === 'BULL_RESEARCH');
      const bear = input.priorArtifacts.find((row) => row.role === 'BEAR_RESEARCH');
      return baseArtifact(input, {
        thesis: `Synthesis for "${input.objective}": weighs ${input.priorArtifacts.length} specialist artifacts without issuing orders.`,
        supportingEvidence: Object.freeze([
          ...(bull ? [`Bull: ${bull.thesis.slice(0, 100)}`] : []),
          `Support count: ${supports}`,
        ]),
        contradictingEvidence: Object.freeze([
          ...(bear ? [`Bear: ${bear.thesis.slice(0, 100)}`] : []),
          `Oppose count: ${opposes}`,
        ]),
        confidence: 0.64,
        uncertainty: 'Medium — synthesis preserves disagreement; no vote-to-trade.',
        timeHorizon: 'MONTHS_1_3',
        recommendationClass,
        toolsUsed: Object.freeze([]),
        knownLimitations: Object.freeze([
          'ResearchSynthesisAgent output is not a trade, allocation, or Execution Authority.',
          'Downstream proposal gates must convert research into human-reviewable proposals separately.',
        ]),
      });
    }
    default: {
      const _exhaustive: never = input.role;
      return _exhaustive;
    }
  }
}
