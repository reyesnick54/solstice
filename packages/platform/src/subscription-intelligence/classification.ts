import type { InferredClassification } from './models.ts';
import type { SubscriptionCategory } from './taxonomy.ts';

const CATEGORY_RULES: readonly {
  readonly pattern: RegExp;
  readonly category: SubscriptionCategory;
  readonly subscriptionType: string;
  readonly cancellable: boolean;
}[] = Object.freeze([
  { pattern: /\b(netflix|hulu|disney|hbo|paramount|peacock|apple tv|prime video)\b/i, category: 'STREAMING', subscriptionType: 'video_streaming', cancellable: true },
  { pattern: /\b(spotify|apple music|tidal|pandora|audible)\b/i, category: 'MEDIA', subscriptionType: 'audio_streaming', cancellable: true },
  { pattern: /\b(microsoft|adobe|dropbox|google one|icloud|github|notion|slack|zoom)\b/i, category: 'SOFTWARE', subscriptionType: 'software_subscription', cancellable: true },
  { pattern: /\b(aws|amazon web services|azure|google cloud|digitalocean|heroku)\b/i, category: 'CLOUD_SERVICES', subscriptionType: 'cloud_infrastructure', cancellable: true },
  { pattern: /\b(verizon|at&t|att|tmobile|t-mobile|comcast|xfinity|spectrum)\b/i, category: 'TELECOMMUNICATIONS', subscriptionType: 'telecom_service', cancellable: false },
  { pattern: /\b(geico|state farm|allstate|progressive|insurance)\b/i, category: 'INSURANCE', subscriptionType: 'insurance_policy', cancellable: false },
  { pattern: /\b(electric|power|energy|utility|water|pg&e|con edison)\b/i, category: 'UTILITIES', subscriptionType: 'utility_bill', cancellable: false },
  { pattern: /\b(planet fitness|gym|equinox|peloton|classpass)\b/i, category: 'FITNESS', subscriptionType: 'fitness_membership', cancellable: true },
  { pattern: /\b(nytimes|wsj|washington post|medium|substack)\b/i, category: 'MEDIA', subscriptionType: 'news_subscription', cancellable: true },
  { pattern: /\b(bank fee|account fee|maintenance fee)\b/i, category: 'FINANCIAL_SERVICES', subscriptionType: 'account_fee', cancellable: false },
]);

/**
 * Deterministic subscription classification. AI may assist only behind
 * structured validation — this path is preferred.
 */
export function classifySubscription(merchantNormalized: string): InferredClassification {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(merchantNormalized)) {
      return Object.freeze({
        category: rule.category,
        subscriptionType: rule.subscriptionType,
        cancellable: rule.cancellable,
        confidence: 'HIGH',
        source: 'DETERMINISTIC',
      });
    }
  }
  return Object.freeze({
    category: 'OTHER_RECURRING',
    subscriptionType: 'recurring_service',
    cancellable: true,
    confidence: 'LOW',
    source: 'DETERMINISTIC',
  });
}

/**
 * AI-assisted classification must pass structured validation.
 */
export function validateAiClassification(
  merchantNormalized: string,
  aiSuggestion: { readonly category: string; readonly subscriptionType: string },
): InferredClassification | null {
  const deterministic = classifySubscription(merchantNormalized);
  if (deterministic.confidence === 'HIGH') {
    return deterministic;
  }
  const validCategory = (['STREAMING', 'SOFTWARE', 'TELECOMMUNICATIONS', 'INSURANCE', 'UTILITIES', 'MEMBERSHIPS', 'FITNESS', 'MEDIA', 'CLOUD_SERVICES', 'FINANCIAL_SERVICES', 'OTHER_RECURRING'] as const).includes(
    aiSuggestion.category as SubscriptionCategory,
  );
  if (!validCategory) {
    return null;
  }
  return Object.freeze({
    category: aiSuggestion.category as SubscriptionCategory,
    subscriptionType: aiSuggestion.subscriptionType,
    cancellable: true,
    confidence: 'MEDIUM',
    source: 'AI_ASSISTED',
  });
}
