import type {
  CompensationAgreement,
  DemandIndexObservation,
  EligibilityFact,
  EligibilityMatch,
  InformationMarketStoreSnapshot,
  MarketRequest,
  MarketRequester,
  OracleAttestation,
  ProofOfContribution,
  SettlementReference,
  UserOpportunity,
} from './types.ts';

export class InformationMarketStore {
  readonly requesters = new Map<string, MarketRequester>();
  readonly requests = new Map<string, MarketRequest>();
  readonly facts = new Map<string, EligibilityFact>();
  readonly attestations = new Map<string, OracleAttestation>();
  readonly matches: EligibilityMatch[] = [];
  readonly opportunities = new Map<string, UserOpportunity>();
  readonly contributions = new Map<string, ProofOfContribution>();
  readonly agreements = new Map<string, CompensationAgreement>();
  readonly settlements = new Map<string, SettlementReference>();
  readonly observations: DemandIndexObservation[] = [];
  readonly replayKeys = new Set<string>();

  snapshot(): InformationMarketStoreSnapshot {
    return Object.freeze({
      requesters: Object.freeze([...this.requesters.values()]),
      requests: Object.freeze([...this.requests.values()]),
      facts: Object.freeze([...this.facts.values()]),
      attestations: Object.freeze([...this.attestations.values()]),
      matches: Object.freeze([...this.matches]),
      opportunities: Object.freeze([...this.opportunities.values()]),
      contributions: Object.freeze([...this.contributions.values()]),
      agreements: Object.freeze([...this.agreements.values()]),
      settlements: Object.freeze([...this.settlements.values()]),
      observations: Object.freeze([...this.observations]),
      replayKeys: Object.freeze([...this.replayKeys]),
    });
  }

  restore(state: InformationMarketStoreSnapshot): void {
    this.requesters.clear();
    this.requests.clear();
    this.facts.clear();
    this.attestations.clear();
    this.matches.length = 0;
    this.opportunities.clear();
    this.contributions.clear();
    this.agreements.clear();
    this.settlements.clear();
    this.observations.length = 0;
    this.replayKeys.clear();
    for (const row of state.requesters) this.requesters.set(row.requesterId, row);
    for (const row of state.requests) this.requests.set(row.requestId, row);
    for (const row of state.facts) this.facts.set(row.subjectId, row);
    for (const row of state.attestations) this.attestations.set(row.attestationId, row);
    this.matches.push(...state.matches);
    for (const row of state.opportunities) this.opportunities.set(row.opportunityId, row);
    for (const row of state.contributions) this.contributions.set(row.contributionId, row);
    for (const row of state.agreements) this.agreements.set(row.agreementId, row);
    for (const row of state.settlements) this.settlements.set(row.settlementRef, row);
    this.observations.push(...state.observations);
    for (const key of state.replayKeys ?? []) this.replayKeys.add(key);
  }
}
