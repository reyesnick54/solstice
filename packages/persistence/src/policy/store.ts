import type { Pool, PoolClient } from 'pg';

import { asUtcInstant } from '../../../domain/src/time.ts';
import type { ManualReviewCase } from '../../../kernel/src/policy/review.ts';
import type {
  LegalEntityCapability,
  PolicyPack,
  PolicyProductBinding,
  PolicyRule,
  PolicySnapshot,
  PolicyVersionRecord,
  SourceReference,
} from '../../../kernel/src/policy/types.ts';
import { canonicalJson } from '../canonical.ts';

export type PersistedPolicyState = {
  readonly packs: readonly PolicyPack[];
  readonly versions: readonly PolicyVersionRecord[];
  readonly capabilities: readonly LegalEntityCapability[];
  readonly products: readonly PolicyProductBinding[];
  readonly sources: readonly SourceReference[];
  readonly usedVersionIds: readonly string[];
  readonly reviews: readonly ManualReviewCase[];
};

export async function persistPolicyState(
  client: PoolClient,
  state: {
    readonly packs?: readonly PolicyPack[];
    readonly versions?: readonly PolicyVersionRecord[];
    readonly capabilities?: readonly LegalEntityCapability[];
    readonly products?: readonly PolicyProductBinding[];
    readonly sources?: readonly SourceReference[];
    readonly usedVersionIds?: readonly string[];
    readonly reviews?: readonly ManualReviewCase[];
  },
): Promise<void> {
  for (const source of state.sources ?? []) {
    await client.query(
      `INSERT INTO customer.policy_source (source_id, kind, citation, uri, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_id) DO UPDATE SET
         kind = EXCLUDED.kind,
         citation = EXCLUDED.citation,
         uri = EXCLUDED.uri,
         notes = EXCLUDED.notes`,
      [source.sourceId, source.kind, source.citation, source.uri ?? null, source.notes ?? null],
    );
  }
  for (const pack of state.packs ?? []) {
    await client.query(
      `INSERT INTO customer.policy_pack (pack_id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (pack_id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description`,
      [pack.packId, pack.name, pack.description],
    );
    for (const version of pack.versions) {
      await upsertVersion(client, version, state.usedVersionIds?.includes(version.versionId) ?? false);
    }
  }
  for (const version of state.versions ?? []) {
    await upsertVersion(client, version, state.usedVersionIds?.includes(version.versionId) ?? false);
  }
  for (const capability of state.capabilities ?? []) {
    await client.query(
      `INSERT INTO customer.legal_entity_capability (
         capability_id, legal_entity_id, action_types, product_ids, product_types,
         environment, enabled, legal_review_status, source_reference
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (capability_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         legal_review_status = EXCLUDED.legal_review_status`,
      [
        capability.capabilityId,
        capability.legalEntityId,
        capability.actionTypes,
        capability.productIds,
        capability.productTypes,
        capability.environment,
        capability.enabled,
        capability.legalReviewStatus,
        capability.sourceReference ?? null,
      ],
    );
  }
  for (const product of state.products ?? []) {
    await client.query(
      `INSERT INTO customer.policy_product_binding (
         product_id, serving_legal_entity_id, supported_jurisdictions, currency,
         account_class, required_capability_id, offering_mode, disclosure_refs
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (product_id) DO UPDATE SET
         required_capability_id = EXCLUDED.required_capability_id,
         offering_mode = EXCLUDED.offering_mode`,
      [
        product.productId,
        product.servingLegalEntityId,
        product.supportedJurisdictions,
        product.currency,
        product.accountClass,
        product.requiredCapabilityId,
        product.offeringMode,
        product.disclosureRefs,
      ],
    );
  }
  for (const review of state.reviews ?? []) {
    await client.query(
      `INSERT INTO customer.manual_review_case (
         review_id, status, reason_codes, snapshot_canonical, facts_hash, override_class,
         created_at, assigned_to, decided_at, decided_by_kind, decided_by_actor_id, decision_note
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (review_id) DO UPDATE SET
         status = EXCLUDED.status,
         assigned_to = EXCLUDED.assigned_to,
         decided_at = EXCLUDED.decided_at,
         decided_by_kind = EXCLUDED.decided_by_kind,
         decided_by_actor_id = EXCLUDED.decided_by_actor_id,
         decision_note = EXCLUDED.decision_note`,
      [
        review.reviewId,
        review.status,
        review.reasonCodes,
        canonicalJson(review.snapshot),
        review.factsHash,
        review.overrideClass,
        review.createdAt,
        review.assignedTo ?? null,
        review.decidedAt ?? null,
        review.decidedBy?.kind ?? null,
        review.decidedBy?.actorId ?? null,
        review.decisionNote ?? null,
      ],
    );
  }
}

async function upsertVersion(
  client: PoolClient,
  version: PolicyVersionRecord,
  used: boolean,
): Promise<void> {
  const existing = await client.query<{ content_hash: string; used_in_decision: boolean }>(
    `SELECT content_hash, used_in_decision FROM customer.policy_version WHERE version_id = $1`,
    [version.versionId],
  );
  if (existing.rows[0]?.used_in_decision && existing.rows[0].content_hash !== version.contentHash) {
    throw new Error(`policy version ${version.versionId} was used and cannot change meaning`);
  }
  await client.query(
    `INSERT INTO customer.policy_pack (pack_id, name, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (pack_id) DO NOTHING`,
    [version.packId, version.packId, 'persisted pack'],
  );
  await client.query(
    `INSERT INTO customer.policy_version (
       version_id, pack_id, version, lifecycle, legal_review_status,
       effective_from, effective_until, content_hash, used_in_decision, screening_requirements
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (version_id) DO UPDATE SET
       lifecycle = EXCLUDED.lifecycle,
       used_in_decision = customer.policy_version.used_in_decision OR EXCLUDED.used_in_decision
     WHERE customer.policy_version.content_hash = EXCLUDED.content_hash`,
    [
      version.versionId,
      version.packId,
      version.version,
      version.lifecycle,
      version.legalReviewStatus,
      version.effectiveFrom,
      version.effectiveUntil ?? null,
      version.contentHash,
      used,
      JSON.stringify(version.screeningRequirements ?? {}),
    ],
  );
  for (const rule of version.rules) {
    await client.query(
      `INSERT INTO customer.policy_rule (
         pack_id, version_id, rule_id, version, jurisdiction, scope, action_types,
         product_types, customer_types, legal_entity, predicate_canonical, effect,
         reason_code, effective_from, effective_until, source_reference,
         legal_review_status, override_class
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12,
         $13, $14, $15, $16, $17, $18
       )
       ON CONFLICT (version_id, rule_id) DO NOTHING`,
      [
        version.packId,
        version.versionId,
        rule.ruleId,
        rule.version,
        rule.jurisdiction,
        rule.scope,
        rule.actionTypes,
        rule.productTypes,
        rule.customerTypes,
        rule.legalEntity ?? null,
        canonicalJson(rule.predicate),
        rule.effect,
        rule.reasonCode,
        rule.effectiveFrom,
        rule.effectiveUntil ?? null,
        rule.sourceReference ?? null,
        rule.legalReviewStatus,
        rule.overrideClass,
      ],
    );
  }
}

export async function loadPolicyState(pool: Pool): Promise<PersistedPolicyState> {
  const [packs, versions, rules, capabilities, products, sources, reviews] = await Promise.all([
    pool.query<{ pack_id: PolicyPack['packId']; name: string; description: string }>(
      `SELECT pack_id, name, description FROM customer.policy_pack`,
    ),
    pool.query<{
      version_id: string;
      pack_id: PolicyPack['packId'];
      version: string;
      lifecycle: PolicyVersionRecord['lifecycle'];
      legal_review_status: PolicyVersionRecord['legalReviewStatus'];
      effective_from: Date;
      effective_until: Date | null;
      content_hash: string;
      used_in_decision: boolean;
    }>(
      `SELECT version_id, pack_id, version, lifecycle, legal_review_status,
              effective_from, effective_until, content_hash, used_in_decision
         FROM customer.policy_version`,
    ),
    pool.query<{
      version_id: string;
      rule_id: string;
      version: string;
      jurisdiction: PolicyRule['jurisdiction'];
      scope: string;
      action_types: string[];
      product_types: string[];
      customer_types: string[];
      legal_entity: string | null;
      predicate_canonical: PolicyRule['predicate'];
      effect: PolicyRule['effect'];
      reason_code: string;
      effective_from: Date;
      effective_until: Date | null;
      source_reference: string | null;
      legal_review_status: PolicyRule['legalReviewStatus'];
      override_class: PolicyRule['overrideClass'];
    }>(
      `SELECT version_id, rule_id, version, jurisdiction, scope, action_types,
              product_types, customer_types, legal_entity, predicate_canonical,
              effect, reason_code, effective_from, effective_until, source_reference,
              legal_review_status, override_class
         FROM customer.policy_rule`,
    ),
    pool.query<{
      capability_id: string;
      legal_entity_id: string;
      action_types: string[];
      product_ids: string[];
      product_types: string[];
      environment: LegalEntityCapability['environment'];
      enabled: boolean;
      legal_review_status: LegalEntityCapability['legalReviewStatus'];
      source_reference: string | null;
    }>(`SELECT * FROM customer.legal_entity_capability`),
    pool.query<{
      product_id: string;
      serving_legal_entity_id: string;
      supported_jurisdictions: string[];
      currency: string;
      account_class: string;
      required_capability_id: string;
      offering_mode: PolicyProductBinding['offeringMode'];
      disclosure_refs: string[];
    }>(`SELECT * FROM customer.policy_product_binding`),
    pool.query<{
      source_id: string;
      kind: SourceReference['kind'];
      citation: string;
      uri: string | null;
      notes: string | null;
    }>(`SELECT * FROM customer.policy_source`),
    pool.query<{
      review_id: string;
      status: ManualReviewCase['status'];
      reason_codes: string[];
      snapshot_canonical: PolicySnapshot;
      facts_hash: string;
      override_class: ManualReviewCase['overrideClass'];
      created_at: Date;
      assigned_to: string | null;
      decided_at: Date | null;
      decided_by_kind: NonNullable<ManualReviewCase['decidedBy']>['kind'] | null;
      decided_by_actor_id: string | null;
      decision_note: string | null;
    }>(`SELECT * FROM customer.manual_review_case`),
  ]);

  const rulesByVersion = new Map<string, PolicyRule[]>();
  for (const row of rules.rows) {
    const list = rulesByVersion.get(row.version_id) ?? [];
    list.push(
      Object.freeze({
        ruleId: row.rule_id,
        version: row.version,
        jurisdiction: row.jurisdiction,
        scope: row.scope,
        actionTypes: Object.freeze(row.action_types),
        productTypes: Object.freeze(row.product_types),
        customerTypes: Object.freeze(row.customer_types),
        ...(row.legal_entity ? { legalEntity: row.legal_entity } : {}),
        predicate: row.predicate_canonical,
        effect: row.effect,
        reasonCode: row.reason_code,
        effectiveFrom: asUtcInstant(row.effective_from.toISOString()),
        ...(row.effective_until
          ? { effectiveUntil: asUtcInstant(row.effective_until.toISOString()) }
          : {}),
        ...(row.source_reference ? { sourceReference: row.source_reference } : {}),
        legalReviewStatus: row.legal_review_status,
        overrideClass: row.override_class,
      }),
    );
    rulesByVersion.set(row.version_id, list);
  }

  const versionRecords = versions.rows.map((row) =>
    Object.freeze({
      versionId: row.version_id,
      packId: row.pack_id,
      version: row.version,
      lifecycle: row.lifecycle,
      legalReviewStatus: row.legal_review_status,
      effectiveFrom: asUtcInstant(row.effective_from.toISOString()),
      ...(row.effective_until
        ? { effectiveUntil: asUtcInstant(row.effective_until.toISOString()) }
        : {}),
      contentHash: row.content_hash,
      rules: Object.freeze(rulesByVersion.get(row.version_id) ?? []),
    }),
  );
  const versionsByPack = new Map<string, PolicyVersionRecord[]>();
  for (const version of versionRecords) {
    const list = versionsByPack.get(version.packId) ?? [];
    list.push(version);
    versionsByPack.set(version.packId, list);
  }

  return {
    packs: packs.rows.map((row) =>
      Object.freeze({
        packId: row.pack_id,
        name: row.name,
        description: row.description,
        versions: Object.freeze(versionsByPack.get(row.pack_id) ?? []),
      }),
    ),
    versions: versionRecords,
    capabilities: capabilities.rows.map((row) =>
      Object.freeze({
        capabilityId: row.capability_id,
        legalEntityId: row.legal_entity_id,
        actionTypes: Object.freeze(row.action_types),
        productIds: Object.freeze(row.product_ids),
        productTypes: Object.freeze(row.product_types),
        environment: row.environment,
        enabled: row.enabled,
        legalReviewStatus: row.legal_review_status,
        ...(row.source_reference ? { sourceReference: row.source_reference } : {}),
      }),
    ),
    products: products.rows.map((row) =>
      Object.freeze({
        productId: row.product_id,
        servingLegalEntityId: row.serving_legal_entity_id,
        supportedJurisdictions: Object.freeze(row.supported_jurisdictions),
        currency: row.currency.trim(),
        accountClass: row.account_class,
        requiredCapabilityId: row.required_capability_id,
        offeringMode: row.offering_mode,
        disclosureRefs: Object.freeze(row.disclosure_refs),
      }),
    ),
    sources: sources.rows.map((row) =>
      Object.freeze({
        sourceId: row.source_id,
        kind: row.kind,
        citation: row.citation,
        ...(row.uri ? { uri: row.uri } : {}),
        ...(row.notes ? { notes: row.notes } : {}),
      }),
    ),
    usedVersionIds: versions.rows.filter((row) => row.used_in_decision).map((row) => row.version_id),
    reviews: reviews.rows.map((row) =>
      Object.freeze({
        reviewId: row.review_id,
        status: row.status,
        reasonCodes: Object.freeze(row.reason_codes),
        snapshot: row.snapshot_canonical,
        factsHash: row.facts_hash,
        overrideClass: row.override_class,
        createdAt: asUtcInstant(row.created_at.toISOString()),
        ...(row.assigned_to ? { assignedTo: row.assigned_to } : {}),
        ...(row.decided_at ? { decidedAt: asUtcInstant(row.decided_at.toISOString()) } : {}),
        ...(row.decided_by_kind && row.decided_by_actor_id
          ? {
              decidedBy: Object.freeze({
                kind: row.decided_by_kind,
                actorId: row.decided_by_actor_id,
              }),
            }
          : {}),
        ...(row.decision_note ? { decisionNote: row.decision_note } : {}),
      }),
    ),
  };
}
