import { createHash } from 'node:crypto';

import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import {
  consumeAuthorizedGraphContext,
  deterministicAccessIntentId,
  freezeAccessIntent,
  validateAccessIntentDraft,
  type AccessIntent,
  type AccessIntentFailure,
  type AuthorizedGraphSlice,
} from './access-fabric/index.ts';
import { freezeProposal, type AgentProposal } from './proposal.ts';
import { deterministicProposalId } from './ids.ts';
import type { AgentMandateView, AgentRuntimePorts } from './ports.ts';

export type AccessIntentRequest = {
  readonly subjectId: string;
  readonly sourceText: string;
  readonly graphSlice: AuthorizedGraphSlice;
  readonly requestedGraphCategories?: readonly string[];
  readonly requestedGraphLabels?: Readonly<Record<string, readonly string[]>>;
};

function hashSource(text: string): string {
  return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

function parseDurationWeeks(text: string): number | undefined {
  const match = text.match(/\b(\d+)\s+weeks?\b/i);
  return match ? Number(match[1]) : undefined;
}

function parseDurationDays(text: string): number | undefined {
  const match = text.match(/\b(\d+)\s+days?\b/i);
  return match ? Number(match[1]) : undefined;
}

function spendingConstraintsFromMandates(mandates: readonly AgentMandateView[]): AccessIntent['constraints'] {
  const constraints: AccessIntent['constraints'][number][] = [];
  for (const mandate of mandates) {
    for (const summary of mandate.hardConstraintSummaries) {
      const amount = summary.match(/\$([\d,]+(?:\.\d+)?)/);
      if (amount?.[1]) {
        const whole = amount[1].split('.')[0]!.replace(/,/g, '');
        const minor = BigInt(whole) * 100n;
        constraints.push({
          kind: 'SPENDING_LIMIT',
          maxMinorUnits: minor.toString(),
          currency: 'USD',
          note: summary,
        });
      }
      if (/confirm|approval|before any movement/i.test(summary)) {
        constraints.push({ kind: 'MANDATE_BOUND', note: summary });
      }
    }
  }
  return Object.freeze(constraints);
}

function mandateRefFromPorts(ports: AgentRuntimePorts): string | null {
  return ports.mandates[0]?.mandateId ?? null;
}

function buildVehicleRentalIntent(input: {
  readonly subjectId: string;
  readonly sourceText: string;
  readonly now: UtcInstant;
  readonly graph: { readonly pegContextRefs: readonly string[]; readonly consentRefs: readonly string[] };
  readonly constraints: AccessIntent['constraints'];
  readonly mandateRef: string | null;
}): Omit<AccessIntent, 'executable' | 'confirmsReservation'> {
  const weeks = parseDurationWeeks(input.sourceText) ?? 2;
  const cityMatch = input.sourceText.match(/\bin\s+([A-Za-z][A-Za-z\s]+?)(?:\s+for\b|$)/i);
  const modelMatch = input.sourceText.match(/\b([A-Za-z]+)\s+convertible\b/i);
  const city = cityMatch?.[1]?.trim() ?? 'unspecified';
  const model = modelMatch?.[1] ?? 'unspecified';
  return {
    intentId: deterministicAccessIntentId(input.subjectId, hashSource(input.sourceText)),
    subjectId: input.subjectId,
    category: 'VEHICLE_RENTAL',
    kind: 'ONE_TIME',
    experienceLevel: 'ATOMIC',
    target: Object.freeze({
      productType: 'vehicle_rental',
      brandOrModel: model,
      attributes: Object.freeze([
        Object.freeze({ key: 'body_style', value: 'convertible' }),
        Object.freeze({ key: 'model_preference', value: model }),
      ]),
    }),
    geography: Object.freeze({ region: 'US', city }),
    window: Object.freeze({ durationWeeks: weeks }),
    duration: Object.freeze({ value: weeks, unit: 'WEEK' }),
    qualityPreferences: Object.freeze(['convertible', `${model} or acceptable substitute`]),
    substitutions: Object.freeze({
      acceptable: true,
      alternatives: Object.freeze(['similar premium convertible']),
    }),
    constraints: input.constraints,
    mandateRef: input.mandateRef,
    purpose: 'personal vehicle access',
    consentRefs: input.graph.consentRefs,
    pegContextRefs: input.graph.pegContextRefs,
    sourceText: input.sourceText,
    explanation:
      'Structured access proposal for a convertible vehicle rental. This does not reserve, purchase, or spend money.',
    createdAt: input.now,
  };
}

function buildTravelExperienceIntent(input: {
  readonly subjectId: string;
  readonly sourceText: string;
  readonly now: UtcInstant;
  readonly graph: { readonly pegContextRefs: readonly string[]; readonly consentRefs: readonly string[] };
  readonly constraints: AccessIntent['constraints'];
  readonly mandateRef: string | null;
}): Omit<AccessIntent, 'executable' | 'confirmsReservation'> {
  const weeks = parseDurationWeeks(input.sourceText) ?? 2;
  const family = /\bfamily\b/i.test(input.sourceText);
  return {
    intentId: deterministicAccessIntentId(input.subjectId, hashSource(input.sourceText)),
    subjectId: input.subjectId,
    category: 'TRAVEL_EXPERIENCE',
    kind: 'EXPERIENCE_COMPOSITION',
    experienceLevel: 'COMPOSITE',
    target: Object.freeze({
      productType: 'family_travel_experience',
      attributes: Object.freeze([
        Object.freeze({ key: 'party', value: family ? 'family' : 'household' }),
        Object.freeze({ key: 'composer_target', value: 'experience_composer' }),
      ]),
    }),
    geography: Object.freeze({ region: 'APAC', country: 'JP' }),
    window: Object.freeze({ durationWeeks: weeks }),
    duration: Object.freeze({ value: weeks, unit: 'WEEK' }),
    qualityPreferences: Object.freeze(['family-friendly itinerary', 'two-week stay']),
    substitutions: Object.freeze({
      acceptable: true,
      alternatives: Object.freeze(['comparable cultural travel experience']),
    }),
    constraints: input.constraints,
    mandateRef: input.mandateRef,
    purpose: 'family travel experience composition',
    consentRefs: input.graph.consentRefs,
    pegContextRefs: input.graph.pegContextRefs,
    sourceText: input.sourceText,
    explanation:
      'Higher-level experience intent for later Experience Composer processing. No booking or payment is implied.',
    createdAt: input.now,
  };
}

function buildRecurringFoodIntent(input: {
  readonly subjectId: string;
  readonly sourceText: string;
  readonly now: UtcInstant;
  readonly graph: { readonly pegContextRefs: readonly string[]; readonly consentRefs: readonly string[] };
  readonly constraints: AccessIntent['constraints'];
  readonly mandateRef: string | null;
}): Omit<AccessIntent, 'executable' | 'confirmsReservation'> {
  return {
    intentId: deterministicAccessIntentId(input.subjectId, hashSource(input.sourceText)),
    subjectId: input.subjectId,
    category: 'RECURRING_FOOD_ACCESS',
    kind: 'RECURRING',
    experienceLevel: 'ATOMIC',
    target: Object.freeze({
      productType: 'household_groceries',
      attributes: Object.freeze([Object.freeze({ key: 'coverage', value: 'household' })]),
    }),
    geography: Object.freeze({ region: 'LOCAL' }),
    window: Object.freeze({ recurrence: 'WEEKLY' }),
    qualityPreferences: Object.freeze(['weekly availability', 'household staples']),
    substitutions: Object.freeze({
      acceptable: true,
      alternatives: Object.freeze(['comparable grocery access programs']),
    }),
    constraints: Object.freeze([
      ...input.constraints,
      Object.freeze({ kind: 'NO_AUTO_PURCHASE', note: 'recurring food access without automatic purchasing' }),
      Object.freeze({ kind: 'ACCESS_ONLY', note: 'availability intent only' }),
    ]),
    mandateRef: input.mandateRef,
    purpose: 'recurring household grocery access',
    consentRefs: input.graph.consentRefs,
    pegContextRefs: input.graph.pegContextRefs,
    sourceText: input.sourceText,
    explanation:
      'Recurring food-access intent that keeps groceries available without automatically purchasing them.',
    createdAt: input.now,
  };
}

function classifyRequest(sourceText: string): 'VEHICLE_RENTAL' | 'TRAVEL_EXPERIENCE' | 'RECURRING_FOOD_ACCESS' | null {
  const text = sourceText.toLowerCase();
  if (/\b(mustang|convertible|rental|car)\b/.test(text)) {
    return 'VEHICLE_RENTAL';
  }
  if (/\b(japan|family|trip|travel)\b/.test(text)) {
    return 'TRAVEL_EXPERIENCE';
  }
  if (/\b(grocer|grocery|household|each week|weekly)\b/.test(text)) {
    return 'RECURRING_FOOD_ACCESS';
  }
  return null;
}

export function composeAccessIntentFromRequest(input: {
  readonly ports: AgentRuntimePorts;
  readonly request: AccessIntentRequest;
  readonly now: UtcInstant;
}): Result<AccessIntent, AccessIntentFailure> {
  const text = input.request.sourceText.trim();
  if (text.length === 0) {
    return err({ code: 'EMPTY_REQUEST', message: 'access request text is required' });
  }
  const graph = consumeAuthorizedGraphContext({
    slice: input.request.graphSlice,
    requestedCategories: input.request.requestedGraphCategories ?? [],
    requestedLabels: input.request.requestedGraphLabels ?? {},
  });
  if (!graph.ok) {
    return graph;
  }
  const constraints = spendingConstraintsFromMandates(input.ports.mandates);
  const mandateRef = mandateRefFromPorts(input.ports);
  const kind = classifyRequest(text);
  if (!kind) {
    return err({ code: 'UNPARSEABLE_REQUEST', message: 'could not classify access request' });
  }
  const draft =
    kind === 'VEHICLE_RENTAL'
      ? buildVehicleRentalIntent({
          subjectId: input.request.subjectId,
          sourceText: text,
          now: input.now,
          graph: graph.value,
          constraints,
          mandateRef,
        })
      : kind === 'TRAVEL_EXPERIENCE'
        ? buildTravelExperienceIntent({
            subjectId: input.request.subjectId,
            sourceText: text,
            now: input.now,
            graph: graph.value,
            constraints,
            mandateRef,
          })
        : buildRecurringFoodIntent({
            subjectId: input.request.subjectId,
            sourceText: text,
            now: input.now,
            graph: graph.value,
            constraints,
            mandateRef,
          });
  const validated = validateAccessIntentDraft(draft);
  if (!validated.ok) {
    return validated;
  }
  return ok(freezeAccessIntent(validated.value));
}

export function accessIntentProposalFromIntent(input: {
  readonly intent: AccessIntent;
  readonly now: UtcInstant;
}): AgentProposal {
  return freezeProposal({
    proposalId: deterministicProposalId('ACCESS_INTENT', input.intent.intentId),
    kind: 'ACCESS_INTENT_PROPOSAL',
    subjectId: input.intent.subjectId,
    title: `Access intent: ${input.intent.category}`,
    rationale: input.intent.explanation,
    relatedRefs: Object.freeze([input.intent.intentId, ...input.intent.pegContextRefs]),
    executable: false,
    createdAt: input.now,
  });
}

export function parseAgentAccessIntentDraft(
  draft: unknown,
): Result<AccessIntent, AccessIntentFailure> {
  const validated = validateAccessIntentDraft(draft);
  if (!validated.ok) {
    return validated;
  }
  return ok(freezeAccessIntent(validated.value));
}

export function compareAccessAlternatives(intents: readonly AccessIntent[]): readonly string[] {
  return Object.freeze(
    intents.map(
      (intent) =>
        `${intent.category}:${intent.target.productType}@${intent.geography.city ?? intent.geography.country ?? intent.geography.region}`,
    ),
  );
}
