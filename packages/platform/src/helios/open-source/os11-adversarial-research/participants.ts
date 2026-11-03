import type { FrozenEvidencePack } from './types.ts';
import type {
  BearCase,
  BullCase,
  ResearchDebateParticipant,
  RiskCase,
  StructuredResearchClaim,
} from './types.ts';

const BULL_PARTICIPANT: ResearchDebateParticipant = Object.freeze({
  role: 'BULL_RESEARCH',
  participantId: 'os11_bull',
  modelProvider: 'LOCAL_DETERMINISTIC',
  modelId: 'tradingagents-bull-v1',
  modelVersion: '1.0.0',
  promptTemplateId: 'helios/os11/bull-research',
  grantsFinancialAuthority: false,
});

const BEAR_PARTICIPANT: ResearchDebateParticipant = Object.freeze({
  role: 'BEAR_RESEARCH',
  participantId: 'os11_bear',
  modelProvider: 'LOCAL_DETERMINISTIC',
  modelId: 'tradingagents-bear-v1',
  modelVersion: '1.0.0',
  promptTemplateId: 'helios/os11/bear-research',
  grantsFinancialAuthority: false,
});

const RISK_PARTICIPANT: ResearchDebateParticipant = Object.freeze({
  role: 'RISK_EVALUATOR',
  participantId: 'os11_risk',
  modelProvider: 'LOCAL_DETERMINISTIC',
  modelId: 'tradingagents-risk-v1',
  modelVersion: '1.0.0',
  promptTemplateId: 'helios/os11/risk-evaluator',
  grantsFinancialAuthority: false,
});

const SYNTHESIS_PARTICIPANT: ResearchDebateParticipant = Object.freeze({
  role: 'SYNTHESIS',
  participantId: 'os11_synthesis',
  modelProvider: 'LOCAL_DETERMINISTIC',
  modelId: 'tradingagents-synthesis-v1',
  modelVersion: '1.0.0',
  promptTemplateId: 'helios/os11/synthesis',
  grantsFinancialAuthority: false,
});

export function defaultDebateParticipants(): readonly ResearchDebateParticipant[] {
  return Object.freeze([BULL_PARTICIPANT, BEAR_PARTICIPANT, RISK_PARTICIPANT, SYNTHESIS_PARTICIPANT]);
}

function freshEvidence(pack: FrozenEvidencePack): readonly (typeof pack.evidence)[number][] {
  return pack.evidence.filter((row) => row.freshnessOk && row.entitlementOk);
}

function staleOrBlockedEvidence(pack: FrozenEvidencePack): readonly (typeof pack.evidence)[number][] {
  return pack.evidence.filter((row) => !row.freshnessOk || !row.entitlementOk);
}

function claim(
  prefix: string,
  idx: number,
  statement: string,
  evidenceIds: readonly string[],
  confidenceBps: number,
  topic: string,
): StructuredResearchClaim {
  return Object.freeze({
    claimId: `${prefix}_${idx}`,
    statement,
    evidenceIds: Object.freeze([...evidenceIds]),
    confidenceBps,
    topic,
  });
}

export function buildBullCase(pack: FrozenEvidencePack, objective: string): BullCase {
  const fresh = freshEvidence(pack);
  const claims: StructuredResearchClaim[] = fresh.map((row, idx) =>
    claim(
      'bull',
      idx,
      `Fresh evidence ${row.evidenceId} supports a constructive read on: ${objective}`,
      [row.evidenceId],
      row.sourceKind === 'MARKET_OBSERVATION' ? 7200 : 6500,
      'upside',
    ),
  );
  if (claims.length === 0) {
    claims.push(
      claim(
        'bull',
        0,
        `Insufficient fresh evidence to support upside; bull case is exploratory only for: ${objective}`,
        [],
        2500,
        'upside',
      ),
    );
  }
  return Object.freeze({
    participant: 'BULL_RESEARCH',
    thesisSummary: `Constructive thesis for ${objective} grounded in admissible fresh evidence.`,
    claims: Object.freeze(claims),
    supportingEvidenceIds: Object.freeze(fresh.map((row) => row.evidenceId)),
    keyAssumptions: Object.freeze([
      'Liquidity and execution remain within mandate bounds.',
      'Observed market inputs remain representative through the decision window.',
    ]),
  });
}

export function buildBearCase(pack: FrozenEvidencePack, objective: string): BearCase {
  const stale = staleOrBlockedEvidence(pack);
  const claims: StructuredResearchClaim[] = stale.map((row, idx) =>
    claim(
      'bear',
      idx,
      `Evidence ${row.evidenceId} is stale or not entitlement-cleared; downside uncertainty rises for: ${objective}`,
      [row.evidenceId],
      7800,
      'downside',
    ),
  );
  if (claims.length === 0) {
    claims.push(
      claim(
        'bear',
        0,
        `No disqualifying stale inputs; bear case focuses on model risk and false precision for: ${objective}`,
        pack.evidence.slice(0, 1).map((row) => row.evidenceId),
        5200,
        'downside',
      ),
    );
  }
  return Object.freeze({
    participant: 'BEAR_RESEARCH',
    thesisSummary: `Bearish or skeptical thesis emphasizing invalidation paths for ${objective}.`,
    claims: Object.freeze(claims),
    supportingEvidenceIds: Object.freeze(stale.map((row) => row.evidenceId)),
    keyAssumptions: Object.freeze([
      'Correlations may shift under stress.',
      'Reported freshness does not guarantee future data quality.',
    ]),
  });
}

export function buildRiskCase(pack: FrozenEvidencePack, objective: string): RiskCase {
  const factors: string[] = [];
  const tail: string[] = [];
  const claims: StructuredResearchClaim[] = [];

  for (const row of pack.evidence) {
    if (!row.freshnessOk) {
      factors.push(`stale-input:${row.evidenceId}`);
    }
    if (!row.entitlementOk) {
      factors.push(`entitlement-gap:${row.evidenceId}`);
    }
    if (row.sourceKind === 'RISK_SIGNAL') {
      factors.push(`risk-signal:${row.sourceRef}`);
      claims.push(
        claim(
          'risk',
          claims.length,
          `Risk signal ${row.sourceRef} elevates tail loss awareness for ${objective}`,
          [row.evidenceId],
          8000,
          'tail-risk',
        ),
      );
    }
  }
  if (claims.length === 0) {
    claims.push(
      claim(
        'risk',
        0,
        `Independent downside review: sizing and exit liquidity must be validated before ${objective}`,
        pack.evidence.slice(0, 1).map((row) => row.evidenceId),
        6000,
        'tail-risk',
      ),
    );
  }
  if (factors.length === 0) {
    factors.push('baseline-model-risk');
  }
  tail.push('Gap risk if liquidity thins during exit.');
  tail.push('Regime shift invalidates historical correlations.');

  return Object.freeze({
    participant: 'RISK_EVALUATOR',
    downsideSummary: `Downside-first evaluation for ${objective}; risk agent is independent of bull/bear narrative.`,
    claims: Object.freeze(claims),
    dominantRiskFactors: Object.freeze(factors),
    tailScenarios: Object.freeze(tail),
    supportingEvidenceIds: Object.freeze(pack.evidence.map((row) => row.evidenceId)),
  });
}
