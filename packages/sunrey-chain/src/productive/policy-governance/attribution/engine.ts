/**
 * Chunk 121 attribution engine.
 *
 * Assigns eligibility shares. Does not mint MoonRey and does not
 * compute a Productive Value Function or final quantity.
 *
 * Ambiguous relationships return REVIEW_REQUIRED. Invalid shares are
 * rejected. They are never silently normalized.
 */

import type { ClaimType, ProductiveCategory } from '../../types.ts';
import { ATTRIBUTION_SHARE_SCALE } from './constitution.ts';
import { attributionDecisionDigest } from './digest.ts';
import { fullShare, validateShare, validateShareSet, zeroShare } from './shares.ts';
import type {
  AttributionDecisionKind,
  AttributionEvaluation,
  AttributionEvaluationInput,
  AttributionReasonCode,
  AttributionSubject,
  CategoryRelationshipRule,
  ClaimRelationshipRule,
  EventRelationship,
  EventRelationshipKind,
  ProductiveAttributionDecision,
  ProductiveAttributionPolicy,
} from './types.ts';

type WorkingDecision = {
  subject: AttributionSubject;
  share: bigint;
  decision: AttributionDecisionKind;
  reasons: AttributionReasonCode[];
  relatedEventIds: string[];
  relatedClaimIds: string[];
};

export function evaluateAttribution(input: AttributionEvaluationInput): AttributionEvaluation {
  const { policy, height } = input;
  const subjects = [...input.subjects].sort((left, right) => left.claimId.localeCompare(right.claimId));
  const relationships = input.relationships ?? [];
  const working = subjects.map((subject) => seedDecision(subject, policy));

  applyRequestedShares(working, input.requestedShares, policy);
  applyReviewConditions(working, relationships, policy);
  applySameEventRules(working, policy);
  applyPairRules(working, relationships, policy);
  applyEventClassDefaults(working, policy);
  enforceSameEventBound(working, policy);

  const decisions = working.map((item, index) =>
    sealDecision(item, policy, height, index),
  );

  return Object.freeze({
    policyId: policy.policyId,
    policyVersion: policy.version,
    decisions,
    rejected: decisions.some((decision) => decision.decision === 'REJECTED'),
    reviewRequired: decisions.some((decision) => decision.decision === 'REVIEW_REQUIRED'),
    authorizesIssuance: false,
    performsFinalValuation: false,
    productionActivated: false,
  });
}

function seedDecision(subject: AttributionSubject, policy: ProductiveAttributionPolicy): WorkingDecision {
  return {
    subject,
    share: fullShare(policy),
    decision: 'FULL_ATTRIBUTION',
    reasons: ['POLICY_VERSION_RETAINED', 'ATTRIBUTION_DOES_NOT_MINT', 'ATTRIBUTION_DOES_NOT_VALUE'],
    relatedEventIds: [...subject.relatedEventIds, ...subject.lineageEventIds],
    relatedClaimIds: [...subject.relatedClaimIds],
  };
}

function applyRequestedShares(
  working: WorkingDecision[],
  requested: Readonly<Record<string, bigint>> | undefined,
  policy: ProductiveAttributionPolicy,
): void {
  if (!requested) {
    return;
  }
  for (const item of working) {
    if (!(item.subject.claimId in requested)) {
      continue;
    }
    const share = requested[item.subject.claimId]!;
    const check = validateShare(share, policy.maximumAggregateShare);
    if (!check.ok) {
      item.share = 0n;
      item.decision = 'REJECTED';
      item.reasons.push(check.code);
      continue;
    }
    item.share = share;
    item.decision = share === 0n
      ? 'ZERO_DUPLICATE_ATTRIBUTION'
      : share === policy.shareScale
        ? 'FULL_ATTRIBUTION'
        : 'PARTIAL_ATTRIBUTION';
  }
}

function applyReviewConditions(
  working: WorkingDecision[],
  relationships: readonly EventRelationship[],
  policy: ProductiveAttributionPolicy,
): void {
  const byBatch = groupBy(working, (item) => item.subject.batchIdentity ?? '');
  for (const [batch, members] of byBatch) {
    if (!batch || members.length < 2) {
      continue;
    }
    const productionClaims = members.filter((item) => claimsPhysicalOutput(item.subject));
    const controllers = new Set(productionClaims.map((item) => item.subject.controllerId));
    if (productionClaims.length > 1 && controllers.size > 1) {
      for (const item of productionClaims) {
        review(item, 'CONTROLLER_CONFLICT_SAME_OUTPUT', peers(item, productionClaims));
      }
    }
    const identities = new Set(members.map((item) => item.subject.economicEventId));
    const categories = new Set(members.map((item) => item.subject.category));
    if (identities.size > 1 && categories.has('GOODS') && members.some((item) => !item.subject.batchIdentity)) {
      for (const item of members) {
        review(item, 'AMBIGUOUS_BATCH_IDENTITY', peers(item, members));
      }
    }
  }

  for (const item of working) {
    if (item.decision === 'REJECTED') {
      continue;
    }
    if (!item.subject.lineageComplete && item.subject.eventClass !== 'PRODUCTION_OUTPUT' && item.subject.claimType !== 'OUTPUT') {
      review(item, 'AMBIGUOUS_LINEAGE');
    }
  }

  for (const rel of relationships) {
    if (rel.kind === 'AMBIGUOUS' || rel.confidence === 'AMBIGUOUS') {
      for (const item of working) {
        if (item.subject.economicEventId === rel.leftEventId || item.subject.economicEventId === rel.rightEventId) {
          review(item, 'AMBIGUOUS_RELATIONSHIP', relatedIds(working, rel));
        }
      }
    }
  }

  detectMeasurementOverlap(working, policy);
  detectCategoryHop(working, policy);
}

function detectMeasurementOverlap(
  working: WorkingDecision[],
  _policy: ProductiveAttributionPolicy,
): void {
  const byEvent = groupBy(working, (item) => item.subject.economicEventId);
  for (const members of byEvent.values()) {
    if (members.length < 2) {
      continue;
    }
    const semantics = new Set(members.map((item) => item.subject.measurementSemantics));
    const categories = new Set(members.map((item) => item.subject.category));
    const known = hasCategoryRule(members, _policy);
    if (semantics.size > 1 && !known && categories.size > 1) {
      for (const item of members) {
        review(item, 'MEASUREMENT_SEMANTICS_OVERLAP', peers(item, members));
      }
    }
  }
}

function detectCategoryHop(
  working: WorkingDecision[],
  policy: ProductiveAttributionPolicy,
): void {
  const byEvent = groupBy(working, (item) => item.subject.economicEventId);
  for (const members of byEvent.values()) {
    if (members.length < 2) {
      continue;
    }
    const categories = [...new Set(members.map((item) => item.subject.category))];
    if (categories.length < 2) {
      continue;
    }
    const known = hasCategoryRule(members, policy);
    if (!known) {
      for (const item of members) {
        review(item, 'CATEGORY_HOP_SUSPECTED', peers(item, members));
      }
    }
  }
}

function applySameEventRules(working: WorkingDecision[], policy: ProductiveAttributionPolicy): void {
  const byEvent = groupBy(working, (item) => item.subject.economicEventId);
  for (const members of byEvent.values()) {
    if (members.length < 2) {
      continue;
    }
    if (members.some((item) => item.decision === 'REJECTED' || item.decision === 'REVIEW_REQUIRED')) {
      continue;
    }
    applyClaimTypeRules(members, policy);
    applyCategoryPair(members, 'SAME_UNDERLYING_EVENT', policy);
    applyGoodsIdentity(members, policy);
    applyDefaultDuplicate(members, policy);
  }
}

function applyClaimTypeRules(members: WorkingDecision[], policy: ProductiveAttributionPolicy): void {
  for (const rule of policy.claimRelationshipRules) {
    const left = members.filter((item) => item.subject.claimType === rule.leftClaimType);
    const right = members.filter((item) => item.subject.claimType === rule.rightClaimType);
    if (left.length === 0 || right.length === 0) {
      continue;
    }
    applyClaimBehavior(left, right, rule, policy);
  }
}

function applyClaimBehavior(
  left: WorkingDecision[],
  right: WorkingDecision[],
  rule: ClaimRelationshipRule,
  policy: ProductiveAttributionPolicy,
): void {
  const reasons = reasonsForClaimRule(rule);
  if (rule.behavior === 'GOVERNED_SPLIT' && rule.split) {
    for (const item of [...left, ...right]) {
      const share = rule.split[item.subject.claimType] ?? 0n;
      assignPartial(item, share, reasons, [...left, ...right], policy);
    }
    return;
  }
  const primaryType = rule.primaryClaimType ?? rule.rightClaimType;
  for (const item of [...left, ...right]) {
    if (item.subject.claimType === primaryType) {
      assignPrimary(item, reasons, [...left, ...right], policy);
    } else {
      assignZero(item, reasons, [...left, ...right]);
    }
  }
}

function applyCategoryPair(
  members: WorkingDecision[],
  relationship: EventRelationshipKind,
  policy: ProductiveAttributionPolicy,
): void {
  const categories = [...new Set(members.map((item) => item.subject.category))];
  for (let i = 0; i < categories.length; i += 1) {
    for (let j = i + 1; j < categories.length; j += 1) {
      const rule = findCategoryRule(policy, categories[i]!, categories[j]!, relationship);
      if (!rule) {
        continue;
      }
      applyCategoryBehavior(
        members.filter((item) => item.subject.category === rule.leftCategory || item.subject.category === rule.rightCategory),
        rule,
        policy,
      );
    }
  }
}

function applyGoodsIdentity(members: WorkingDecision[], policy: ProductiveAttributionPolicy): void {
  const manufacturing = members.filter((item) => item.subject.category === 'MANUFACTURING');
  const goods = members.filter((item) => item.subject.category === 'GOODS');
  if (manufacturing.length === 0 || goods.length === 0) {
    return;
  }
  const rule = findCategoryRule(policy, 'MANUFACTURING', 'GOODS', 'GOODS_IDENTITY')
    ?? findCategoryRule(policy, 'MANUFACTURING', 'GOODS', 'SAME_UNDERLYING_EVENT');
  if (!rule) {
    return;
  }
  applyCategoryBehavior([...manufacturing, ...goods], rule, policy);
}

function applyDefaultDuplicate(members: WorkingDecision[], policy: ProductiveAttributionPolicy): void {
  const credited = members.filter((item) => item.share === policy.shareScale && item.decision === 'FULL_ATTRIBUTION');
  if (credited.length <= 1) {
    return;
  }
  const primary = pickPrimary(credited, policy);
  for (const item of credited) {
    if (item === primary) {
      item.reasons.push('PRIMARY_CATEGORY_ATTRIBUTION');
      continue;
    }
    if (policy.defaultDuplicateBehavior === 'REVIEW_REQUIRED') {
      review(item, 'SAME_EVENT_DUPLICATE', peers(item, members));
      continue;
    }
    assignZero(item, ['SAME_EVENT_DUPLICATE'], members);
  }
}

function applyPairRules(
  working: WorkingDecision[],
  relationships: readonly EventRelationship[],
  policy: ProductiveAttributionPolicy,
): void {
  const inferred = inferRelationships(working);
  const all = [...relationships, ...inferred];
  for (const rel of all) {
    if (rel.kind === 'AMBIGUOUS' || rel.confidence === 'AMBIGUOUS') {
      continue;
    }
    const left = working.filter((item) => item.subject.economicEventId === rel.leftEventId);
    const right = working.filter((item) => item.subject.economicEventId === rel.rightEventId);
    if (left.length === 0 || right.length === 0) {
      continue;
    }
    if ([...left, ...right].some((item) => item.decision === 'REJECTED' || item.decision === 'REVIEW_REQUIRED')) {
      continue;
    }
    if (rel.kind === 'DEPENDENT_INPUT' || rel.kind === 'LINEAGE_ONLY') {
      applyDependentInput(left, right, rel);
      continue;
    }
    if (rel.kind === 'DISTINCT_REALIZED_SERVICE') {
      applyDistinctService(left, right, policy, rel);
      continue;
    }
    if (rel.kind === 'CONTROLLER_RELABEL' || (rel.kind === 'SAME_UNDERLYING_EVENT' && sameControllerRelabel(left, right))) {
      applyRelabel([...left, ...right], policy);
    }
  }
}

function inferRelationships(working: WorkingDecision[]): EventRelationship[] {
  const inferred: EventRelationship[] = [];
  for (const item of working) {
    for (const parent of item.subject.lineageEventIds) {
      inferred.push({
        leftEventId: parent,
        rightEventId: item.subject.economicEventId,
        kind: item.subject.eventClass === 'CONSUMPTION' ? 'DEPENDENT_INPUT' : 'LINEAGE_ONLY',
        confidence: 'INFERRED',
      });
    }
  }
  return inferred;
}

function applyDependentInput(
  producers: WorkingDecision[],
  consumers: WorkingDecision[],
  rel: EventRelationship,
): void {
  const producerSide = producers[0]?.subject.economicEventId === rel.leftEventId ? producers : consumers;
  const consumerSide = producerSide === producers ? consumers : producers;
  for (const item of producerSide) {
    if (item.decision === 'FULL_ATTRIBUTION' || item.decision === 'SEPARATE_VALUE_EVENT') {
      item.reasons.push('DEPENDENT_INPUT_NOT_OWNERSHIP');
      link(item, consumerSide);
    }
  }
  for (const item of consumerSide) {
    if (item.subject.eventClass === 'CONSUMPTION' || item.subject.category !== producerSide[0]?.subject.category) {
      if (item.subject.eventClass === 'CONSUMPTION') {
        assignZero(item, ['ENERGY_CONSUMPTION_IS_LINEAGE', 'DEPENDENT_INPUT_NOT_OWNERSHIP'], producerSide);
      } else {
        item.reasons.push('DEPENDENT_INPUT_NOT_OWNERSHIP');
        link(item, producerSide);
      }
    }
  }
}

function applyDistinctService(
  left: WorkingDecision[],
  right: WorkingDecision[],
  policy: ProductiveAttributionPolicy,
  rel: EventRelationship,
): void {
  const members = [...left, ...right];
  const controllers = new Set(members.map((item) => item.subject.controllerId));
  for (const group of [left, right]) {
    for (const item of group) {
      const counterpart = group === left ? right : left;
      const pairRule = findCategoryRule(
        policy,
        item.subject.category,
        counterpart[0]!.subject.category,
        'DISTINCT_REALIZED_SERVICE',
      );
      const required = pairRule?.requiredEvidence ?? evidenceForCategory(item.subject.category, policy);
      if (!isIndependentServiceClaim(item.subject)) {
        item.reasons.push(controllers.size === 1 ? 'VERTICAL_DISTINCT_STAGES' : 'SEPARATE_REALIZED_SERVICE');
        link(item, counterpart);
        continue;
      }
      if (item.subject.category === 'LOGISTICS_TRANSPORTATION' && item.subject.measurementSemantics === 'units_produced') {
        review(item, 'MANUFACTURING_QUANTITY_NOT_LOGISTICS_OUTPUT', counterpart);
        continue;
      }
      if (!hasIndependentEvidence(item.subject, required, policy.reviewThreshold)) {
        review(item, 'INDEPENDENT_SERVICE_EVIDENCE_INSUFFICIENT', counterpart);
        continue;
      }
      if (item.decision === 'REJECTED' || item.decision === 'REVIEW_REQUIRED') {
        continue;
      }
      item.decision = 'SEPARATE_VALUE_EVENT';
      item.share = fullShare(policy);
      item.reasons.push(
        controllers.size === 1 ? 'VERTICAL_DISTINCT_STAGES' : 'SEPARATE_REALIZED_SERVICE',
        ...serviceReason(item.subject.category),
      );
      link(item, counterpart);
    }
  }
  void rel;
}

function isIndependentServiceClaim(subject: AttributionSubject): boolean {
  return subject.category === 'LOGISTICS_TRANSPORTATION'
    || subject.category === 'STORAGE'
    || subject.category === 'INFRASTRUCTURE'
    || subject.eventClass === 'DELIVERY';
}

function claimsPhysicalOutput(subject: AttributionSubject): boolean {
  return (subject.category === 'GOODS' || subject.category === 'MANUFACTURING' || subject.eventClass === 'PRODUCTION_OUTPUT')
    && subject.eventClass !== 'CONSUMPTION'
    && subject.eventClass !== 'DELIVERY'
    && subject.eventClass !== 'USAGE'
    && subject.category !== 'LOGISTICS_TRANSPORTATION'
    && subject.category !== 'STORAGE'
    && subject.category !== 'ENERGY';
}

function applyRelabel(members: WorkingDecision[], policy: ProductiveAttributionPolicy): void {
  const primary = pickPrimary(members, policy);
  for (const item of members) {
    if (item === primary) {
      item.reasons.push('VERTICAL_RELABEL_SAME_EVENT', 'PRIMARY_CATEGORY_ATTRIBUTION');
      continue;
    }
    assignZero(item, ['VERTICAL_RELABEL_SAME_EVENT', 'SAME_EVENT_DUPLICATE'], members);
  }
}

function applyEventClassDefaults(working: WorkingDecision[], policy: ProductiveAttributionPolicy): void {
  for (const item of working) {
    if (item.decision === 'REJECTED' || item.decision === 'REVIEW_REQUIRED' || item.decision === 'ZERO_DUPLICATE_ATTRIBUTION') {
      continue;
    }
    const rule = policy.eventClassRules.find((entry) => entry.eventClass === item.subject.eventClass);
    if (!rule) {
      continue;
    }
    if (!rule.mayReceiveFullAttribution && item.decision === 'FULL_ATTRIBUTION' && item.subject.eventClass === 'CONSUMPTION') {
      assignZero(item, ['ENERGY_CONSUMPTION_IS_LINEAGE'], []);
    }
  }
}

function applyCategoryBehavior(
  members: WorkingDecision[],
  rule: CategoryRelationshipRule,
  policy: ProductiveAttributionPolicy,
): void {
  const reasons = reasonsForCategoryRule(rule);
  if (rule.behavior === 'REVIEW') {
    for (const item of members) {
      review(item, reasons[0] ?? 'AMBIGUOUS_RELATIONSHIP', peers(item, members));
    }
    return;
  }
  if (rule.behavior === 'GOVERNED_SPLIT' && rule.split) {
    const shares = members.map((item) => rule.split?.[item.subject.category] ?? 0n);
    const check = validateShareSet(shares, policy.maximumAggregateShare);
    if (!check.ok) {
      for (const item of members) {
        item.share = 0n;
        item.decision = 'REJECTED';
        item.reasons.push(check.code);
      }
      return;
    }
    for (const item of members) {
      const share = rule.split[item.subject.category] ?? 0n;
      assignPartial(item, share, reasons, members, policy);
    }
    return;
  }
  if (rule.behavior === 'LINEAGE_ONLY' || rule.behavior === 'PRIMARY_AND_LINEAGE') {
    const primary = rule.primaryCategory;
    for (const item of members) {
      if (primary && item.subject.category === primary) {
        assignPrimary(item, reasons, members, policy);
      } else {
        assignZero(item, reasons, members);
      }
    }
  }
}

function enforceSameEventBound(working: WorkingDecision[], policy: ProductiveAttributionPolicy): void {
  const byEvent = groupBy(working, (item) => item.subject.economicEventId);
  for (const members of byEvent.values()) {
    const live = members.filter((item) => item.decision !== 'REJECTED' && item.decision !== 'REVIEW_REQUIRED');
    const check = validateShareSet(live.map((item) => item.share), policy.maximumAggregateShare);
    if (check.ok) {
      continue;
    }
    for (const item of live) {
      item.share = 0n;
      item.decision = 'REJECTED';
      item.reasons.push(check.code);
    }
  }
}

function sealDecision(
  item: WorkingDecision,
  policy: ProductiveAttributionPolicy,
  height: number,
  index: number,
): ProductiveAttributionDecision {
  const draft: Omit<ProductiveAttributionDecision, 'decisionDigest'> = {
    decisionId: `pad.${policy.policyId}.${policy.version}.${item.subject.claimId}.${height}.${index}`,
    policyId: policy.policyId,
    policyVersion: policy.version,
    economicEventId: item.subject.economicEventId,
    claimId: item.subject.claimId,
    contributionId: item.subject.contributionId,
    category: item.subject.category,
    claimType: item.subject.claimType,
    attributionShare: item.share,
    shareScale: ATTRIBUTION_SHARE_SCALE,
    decision: item.decision,
    relatedEventIds: unique(item.relatedEventIds),
    relatedClaimIds: unique(item.relatedClaimIds),
    evidenceRefs: [...item.subject.evidenceRefs],
    reasonCodes: unique(item.reasons),
    authorizesIssuance: false,
    performsFinalValuation: false,
  };
  return Object.freeze({ ...draft, decisionDigest: attributionDecisionDigest(draft) });
}

function assignPrimary(
  item: WorkingDecision,
  reasons: readonly AttributionReasonCode[],
  peersList: WorkingDecision[],
  policy: ProductiveAttributionPolicy,
): void {
  if (item.decision === 'REJECTED' || item.decision === 'REVIEW_REQUIRED') {
    return;
  }
  item.share = fullShare(policy);
  item.decision = 'FULL_ATTRIBUTION';
  item.reasons.push(...reasons, 'PRIMARY_CATEGORY_ATTRIBUTION');
  link(item, peersList);
}

function assignZero(
  item: WorkingDecision,
  reasons: readonly AttributionReasonCode[],
  peersList: WorkingDecision[],
): void {
  if (item.decision === 'REJECTED' || item.decision === 'REVIEW_REQUIRED') {
    return;
  }
  item.share = zeroShare();
  item.decision = 'ZERO_DUPLICATE_ATTRIBUTION';
  item.reasons.push(...reasons);
  link(item, peersList);
}

function assignPartial(
  item: WorkingDecision,
  share: bigint,
  reasons: readonly AttributionReasonCode[],
  peersList: WorkingDecision[],
  policy: ProductiveAttributionPolicy,
): void {
  if (item.decision === 'REJECTED' || item.decision === 'REVIEW_REQUIRED') {
    return;
  }
  const check = validateShare(share, policy.maximumAggregateShare);
  if (!check.ok) {
    item.share = 0n;
    item.decision = 'REJECTED';
    item.reasons.push(check.code);
    return;
  }
  item.share = share;
  item.decision = share === 0n
    ? 'ZERO_DUPLICATE_ATTRIBUTION'
    : share === policy.shareScale
      ? 'FULL_ATTRIBUTION'
      : 'PARTIAL_ATTRIBUTION';
  item.reasons.push(...reasons);
  link(item, peersList);
}

function review(
  item: WorkingDecision,
  reason: AttributionReasonCode,
  peersList: WorkingDecision[] = [],
): void {
  if (item.decision === 'REJECTED') {
    return;
  }
  item.share = 0n;
  item.decision = 'REVIEW_REQUIRED';
  item.reasons.push(reason);
  link(item, peersList);
}

function link(item: WorkingDecision, peersList: WorkingDecision[]): void {
  for (const peer of peersList) {
    if (peer.subject.claimId === item.subject.claimId) {
      continue;
    }
    item.relatedClaimIds.push(peer.subject.claimId);
    item.relatedEventIds.push(peer.subject.economicEventId);
  }
}

function findCategoryRule(
  policy: ProductiveAttributionPolicy,
  left: ProductiveCategory,
  right: ProductiveCategory,
  relationship: EventRelationshipKind,
): CategoryRelationshipRule | undefined {
  return policy.categoryRelationshipRules.find(
    (rule) =>
      rule.relationship === relationship
      && (
        (rule.leftCategory === left && rule.rightCategory === right)
        || (rule.leftCategory === right && rule.rightCategory === left)
      ),
  );
}

function hasCategoryRule(members: WorkingDecision[], policy: ProductiveAttributionPolicy): boolean {
  const categories = [...new Set(members.map((item) => item.subject.category))];
  for (let i = 0; i < categories.length; i += 1) {
    for (let j = i + 1; j < categories.length; j += 1) {
      const found = policy.categoryRelationshipRules.some(
        (rule) =>
          (rule.leftCategory === categories[i] && rule.rightCategory === categories[j])
          || (rule.leftCategory === categories[j] && rule.rightCategory === categories[i]),
      );
      if (found) {
        return true;
      }
    }
  }
  return false;
}

function pickPrimary(members: WorkingDecision[], policy: ProductiveAttributionPolicy): WorkingDecision {
  const ranked = [...members].sort((left, right) => {
    const leftRank = primaryRank(left.subject, policy);
    const rightRank = primaryRank(right.subject, policy);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.subject.claimId.localeCompare(right.subject.claimId);
  });
  return ranked[0]!;
}

function primaryRank(subject: AttributionSubject, policy: ProductiveAttributionPolicy): number {
  const asPrimary = policy.categoryRelationshipRules.some((rule) => rule.primaryCategory === subject.category);
  if (asPrimary) {
    return 0;
  }
  if (subject.claimType === 'OUTPUT' && subject.eventClass === 'PRODUCTION_OUTPUT') {
    return 1;
  }
  if (subject.claimType === 'OUTPUT') {
    return 2;
  }
  return 5;
}

function hasIndependentEvidence(
  subject: AttributionSubject,
  required: readonly string[],
  threshold: number,
): boolean {
  if (required.length === 0) {
    return subject.evidenceRefs.length >= threshold;
  }
  const haystack = [subject.measurementSemantics, ...subject.evidenceRefs].join('|');
  const hits = required.filter((token) => haystack.includes(token)).length;
  return hits >= threshold;
}

function evidenceForCategory(category: ProductiveCategory, policy: ProductiveAttributionPolicy): readonly string[] {
  const rule = policy.categoryRelationshipRules.find(
    (item) => item.rightCategory === category || item.leftCategory === category,
  );
  return rule?.requiredEvidence ?? policy.requiredEvidenceForSeparateValue;
}

function serviceReason(category: ProductiveCategory): AttributionReasonCode[] {
  if (category === 'LOGISTICS_TRANSPORTATION') {
    return ['INDEPENDENT_LOGISTICS_SERVICE'];
  }
  if (category === 'STORAGE') {
    return ['INDEPENDENT_STORAGE_SERVICE'];
  }
  if (category === 'INFRASTRUCTURE') {
    return ['INDEPENDENT_INFRASTRUCTURE_SERVICE'];
  }
  return ['SEPARATE_REALIZED_SERVICE'];
}

function reasonsForCategoryRule(rule: CategoryRelationshipRule): AttributionReasonCode[] {
  if (rule.leftCategory === 'MANUFACTURING' && rule.rightCategory === 'AUTOMATED_MACHINE_OUTPUT') {
    return ['MACHINE_ACTIVITY_NOT_NEW_OUTPUT', 'SAME_EVENT_DUPLICATE'];
  }
  if (rule.rightCategory === 'GOODS' || rule.leftCategory === 'GOODS') {
    return ['GOODS_IDENTITY_NOT_NEW_OUTPUT'];
  }
  if (rule.leftCategory === 'COMPUTE' && rule.rightCategory === 'AI_COMPUTE') {
    return ['COMPUTE_AI_SAME_EXECUTION', 'SAME_EVENT_DUPLICATE'];
  }
  if (
    (rule.leftCategory === 'REAL_ESTATE_USE' && rule.rightCategory === 'INFRASTRUCTURE')
    || (rule.leftCategory === 'INFRASTRUCTURE' && rule.rightCategory === 'REAL_ESTATE_USE')
  ) {
    return ['REAL_ESTATE_INFRASTRUCTURE_SAME_SERVICE', 'SAME_EVENT_DUPLICATE'];
  }
  if (
    (rule.leftCategory === 'INFRASTRUCTURE' && rule.rightCategory === 'LOGISTICS_TRANSPORTATION')
    || (rule.leftCategory === 'LOGISTICS_TRANSPORTATION' && rule.rightCategory === 'INFRASTRUCTURE')
  ) {
    return ['INFRASTRUCTURE_LOGISTICS_DUPLICATE', 'SAME_EVENT_DUPLICATE'];
  }
  if (rule.relationship === 'DEPENDENT_INPUT') {
    return ['ENERGY_CONSUMPTION_IS_LINEAGE', 'DEPENDENT_INPUT_NOT_OWNERSHIP'];
  }
  return ['SAME_EVENT_DUPLICATE'];
}

function reasonsForClaimRule(rule: ClaimRelationshipRule): AttributionReasonCode[] {
  if (rule.leftClaimType === 'CAPACITY' || rule.rightClaimType === 'CAPACITY') {
    return ['CAPACITY_IS_NOT_OUTPUT'];
  }
  if (rule.leftClaimType === 'DELIVERY' || rule.rightClaimType === 'DELIVERY') {
    return ['OUTPUT_IS_NOT_DELIVERY', 'DELIVERY_NOT_AUTOMATIC_PRODUCTION'];
  }
  return ['SAME_EVENT_DUPLICATE'];
}

function sameControllerRelabel(left: WorkingDecision[], right: WorkingDecision[]): boolean {
  if (left[0]?.subject.economicEventId !== right[0]?.subject.economicEventId) {
    return false;
  }
  const controllers = new Set([...left, ...right].map((item) => item.subject.controllerId));
  const categories = new Set([...left, ...right].map((item) => item.subject.category));
  return controllers.size === 1 && categories.size > 1;
}

function relatedIds(working: WorkingDecision[], rel: EventRelationship): WorkingDecision[] {
  return working.filter(
    (item) => item.subject.economicEventId === rel.leftEventId || item.subject.economicEventId === rel.rightEventId,
  );
}

function peers(item: WorkingDecision, members: WorkingDecision[]): WorkingDecision[] {
  return members.filter((peer) => peer.subject.claimId !== item.subject.claimId);
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
