export const TRANSCRIPT_SEGMENT_KINDS = [
  'PREPARED_REMARKS',
  'ANALYST_QUESTION',
  'MANAGEMENT_ANSWER',
  'OPERATOR',
  'OTHER',
] as const;

export const SPEAKER_ROLES = [
  'CEO',
  'CFO',
  'COO',
  'OTHER_EXECUTIVE',
  'ANALYST',
  'UNKNOWN',
] as const;

export const CONTRADICTION_CLASSIFICATIONS = [
  'CONSISTENT',
  'APPARENT_CONFLICT',
  'NOT_COMPARABLE',
  'INSUFFICIENT_EVIDENCE',
] as const;

export const LLM_LEAKAGE_MODES = [
  'CHRONOLOGICALLY_SAFE_MODEL',
  'ANONYMIZED_EVIDENCE_MODEL',
  'NON_CAUSAL_RESEARCH_ONLY',
] as const;

export const CONSENSUS_ERROR_SIGN = [-1, 0, 1] as const;

export const EARN05_TOPIC_LEXICON = Object.freeze({
  risk: Object.freeze([
    'risk',
    'uncertain',
    'headwind',
    'volatility',
    'macro',
    'recession',
    'inflation',
    'supply chain',
    'geopolit',
  ]),
  capitalAllocation: Object.freeze([
    'capital allocation',
    'buyback',
    'repurchase',
    'dividend',
    'm&a',
    'acquisition',
    'investment',
    'capex',
    'shareholder return',
  ]),
  demand: Object.freeze([
    'demand',
    'volume',
    'orders',
    'bookings',
    'pipeline',
    'backlog',
    'customer',
    'consumption',
  ]),
  pricing: Object.freeze([
    'price',
    'pricing',
    'asp',
    'rate',
    'tariff',
    'premium',
    'discount',
  ]),
  margin: Object.freeze([
    'margin',
    'gross margin',
    'operating margin',
    'ebitda',
    'profitability',
    'mix',
  ]),
  hiring: Object.freeze([
    'hire',
    'hiring',
    'headcount',
    'workforce',
    'talent',
    'recruit',
  ]),
  costControl: Object.freeze([
    'cost',
    'efficiency',
    'productivity',
    'restructur',
    'savings',
    'rationaliz',
    'lean',
  ]),
});

export const EARN05_HEDGING_LEXICON = Object.freeze([
  'may',
  'might',
  'could',
  'approximately',
  'roughly',
  'believe',
  'expect',
  'anticipate',
  'subject to',
  'depending',
  'potentially',
  'possible',
  'uncertain',
]);

export const EARN05_FORWARD_LEXICON = Object.freeze([
  'will',
  'expect',
  'outlook',
  'guidance',
  'forecast',
  'next quarter',
  'next year',
  'going forward',
  'future',
  'plan to',
  'intend',
]);

export const EARN05_BACKWARD_LEXICON = Object.freeze([
  'last quarter',
  'last year',
  'prior year',
  'previously',
  'compared to',
  'year ago',
  'sequential',
  'yoy',
  'quarter over quarter',
]);

export const EARN05_EVASION_LEXICON = Object.freeze([
  'not prepared to',
  'do not disclose',
  'cannot comment',
  'no comment',
  'as we said',
  'as previously',
  'we will update',
  'stay tuned',
  'too early',
]);
