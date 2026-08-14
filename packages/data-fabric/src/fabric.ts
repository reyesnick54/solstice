import {
  asActionIntentId,
  asActorId,
  asIdempotencyKey,
  asUtcInstant,
  type Actor,
  type Result,
} from '@solstice/domain';
import { LIVE_DATA_MARKET_ENABLED } from '@solstice/flags';
import {
  ComplianceKernel,
  freezeIntent,
  type ActionIntent,
  type KernelAuthorization,
  type KernelDecision,
  type PersonalDataCategory,
} from '@solstice/kernel';

import { CleanRoom, type AuthorizedAggregate, type CleanRoomQuery, type CleanRoomRefusal } from './clean-room/engine.ts';
import { PrivacyBudgetLedger } from './clean-room/budget.ts';
import { ConsentLedger } from './consent/ledger.ts';
import type { ConsentGrantInput, ConsentModifyInput, ConsentRecord } from './consent/types.ts';
import { SimulatedLocalKeyProvider } from './keys/simulated-local.ts';
import { parseAccessRequest, type AccessRequest } from './purpose/access-request.ts';
import { PurposeFirewall, type FirewallDenial, type PurposeAuthorization } from './purpose/firewall.ts';
import { InMemoryVaultStorage } from './storage/memory.ts';
import { generateSyntheticPopulation, syntheticSubjectRefs } from './synthetic/generator.ts';
import { indicativeCompensation, type IndicativeCompensation, type ValuationInput } from './valuation/model.ts';
import { ModelRegistry, registerDataValuationModel } from './valuation/registry.ts';
import { SegmentedPersonalDataVault, type VaultWriteReceipt } from './vault/segmented-vault.ts';

export type FabricDecision<T> =
  | { readonly ok: true; readonly value: T; readonly kernel: KernelDecision }
  | { readonly ok: false; readonly error: FirewallDenial | CleanRoomRefusal | { readonly code: 'KERNEL_REFUSED'; readonly decision: KernelDecision } };

/**
 * Personal Data Fabric orchestrator. Consent mutations and vault writes
 * go through the Compliance Kernel. Access goes through the Purpose Firewall
 * then a second Kernel gate for the clean-room job.
 */
export class PersonalDataFabric {
  readonly kernel: ComplianceKernel;
  readonly vault: SegmentedPersonalDataVault;
  readonly consent: ConsentLedger;
  readonly firewall: PurposeFirewall;
  readonly cleanRoom: CleanRoom;
  readonly models: ModelRegistry;
  readonly keys: SimulatedLocalKeyProvider;
  readonly storage: InMemoryVaultStorage;
  readonly budget: PrivacyBudgetLedger;
  #seq = 0;

  constructor(kernel: ComplianceKernel = new ComplianceKernel()) {
    if (LIVE_DATA_MARKET_ENABLED !== false) {
      throw new Error('LIVE_DATA_MARKET_ENABLED must remain false');
    }
    this.kernel = kernel;
    this.keys = new SimulatedLocalKeyProvider('solstice-sim-vault-seed-v1');
    this.storage = new InMemoryVaultStorage();
    this.vault = new SegmentedPersonalDataVault(this.keys, this.storage);
    this.consent = new ConsentLedger();
    this.firewall = new PurposeFirewall(kernel.vault, this.consent);
    this.budget = new PrivacyBudgetLedger();
    this.cleanRoom = new CleanRoom(this.vault, this.budget);
    this.models = new ModelRegistry();
    registerDataValuationModel(this.models);
  }

  populateSynthetic(input: {
    readonly subjectCount: number;
    readonly actor: Actor;
    readonly occurredAt: string;
    readonly jurisdiction: string;
  }): readonly VaultWriteReceipt[] {
    const records = generateSyntheticPopulation({
      subjectCount: input.subjectCount,
      classifiedAt: input.occurredAt,
    });
    const receipts: VaultWriteReceipt[] = [];
    for (const record of records) {
      const authorization = this.mustAuthorize(
        this.intent({
          kind: 'STORE_PERSONAL_DATA',
          actor: input.actor,
          occurredAt: input.occurredAt,
          sourceJurisdiction: input.jurisdiction,
          payload: {
            category: record.category,
            provenance: 'SYNTHETIC',
            recordHash: record.recordId,
            purpose: 'WELLNESS_RESEARCH',
          },
        }),
      );
      receipts.push(
        this.vault.storeClassifiedRecord(authorization, {
          recordId: record.recordId,
          subjectRef: record.subjectRef,
          category: record.category,
          attributes: record.attributes,
          classifiedAt: record.classifiedAt,
          provenance: 'SYNTHETIC',
        }),
      );
    }
    return Object.freeze(receipts);
  }

  grantConsent(input: {
    readonly actor: Actor;
    readonly occurredAt: string;
    readonly grant: ConsentGrantInput;
  }): ConsentRecord {
    const authorization = this.mustAuthorize(
      this.intent({
        kind: 'GRANT_CONSENT',
        actor: input.actor,
        occurredAt: input.occurredAt,
        sourceJurisdiction: input.grant.jurisdiction,
        payload: {
          consentId: input.grant.consentId,
          purpose: input.grant.purpose,
          categories: input.grant.dataCategories,
          subjectRef: input.grant.subjectRef,
        },
      }),
    );
    return this.consent.appendConsentGrant(authorization, input.grant);
  }

  modifyConsent(input: {
    readonly actor: Actor;
    readonly occurredAt: string;
    readonly jurisdiction: string;
    readonly modify: ConsentModifyInput;
  }): ConsentRecord {
    const current = this.consent.latest(input.modify.consentId);
    if (!current) {
      throw new Error(`consent ${input.modify.consentId} not found`);
    }
    const authorization = this.mustAuthorize(
      this.intent({
        kind: 'MODIFY_CONSENT',
        actor: input.actor,
        occurredAt: input.occurredAt,
        sourceJurisdiction: input.jurisdiction,
        payload: {
          consentId: input.modify.consentId,
          purpose: input.modify.changes.purpose ?? current.purpose,
          categories: input.modify.changes.dataCategories ?? current.dataCategories,
        },
      }),
    );
    return this.consent.appendConsentModification(authorization, input.modify);
  }

  revokeConsent(input: {
    readonly actor: Actor;
    readonly occurredAt: string;
    readonly jurisdiction: string;
    readonly consentId: string;
  }): ConsentRecord {
    const current = this.consent.latest(input.consentId);
    if (!current) {
      throw new Error(`consent ${input.consentId} not found`);
    }
    const authorization = this.mustAuthorize(
      this.intent({
        kind: 'REVOKE_CONSENT',
        actor: input.actor,
        occurredAt: input.occurredAt,
        sourceJurisdiction: input.jurisdiction,
        payload: {
          consentId: input.consentId,
          purpose: current.purpose,
          categories: current.dataCategories,
        },
      }),
    );
    return this.consent.appendConsentRevocation(authorization, input.consentId);
  }

  runCleanRoom(input: {
    readonly actor: Actor;
    readonly occurredAt: string;
    readonly request: unknown;
    readonly query: CleanRoomQuery;
    readonly subjectRefs: readonly string[];
    readonly sessionValid: boolean;
    readonly capability?: { readonly forbiddenDataCategories: readonly string[] };
  }): FabricDecision<AuthorizedAggregate> {
    const parsed = parseAccessRequest(input.request);
    const gate = this.firewall.authorize({
      request: input.request,
      now: input.occurredAt,
      subjectRefs: input.subjectRefs,
      sessionValid: input.sessionValid,
      capability: input.capability,
    });
    if (!gate.ok) {
      return { ok: false, error: gate.error };
    }
    if (!parsed.ok) {
      return { ok: false, error: gate.error };
    }
    const kernelResult = this.kernel.evaluate(
      this.intent({
        kind: 'RUN_CLEAN_ROOM',
        actor: input.actor,
        occurredAt: input.occurredAt,
        sourceJurisdiction: parsed.value.jurisdiction,
        payload: {
          purpose: parsed.value.purpose,
          categories: parsed.value.dataCategories,
          requesterId: parsed.value.requester.id,
          queryId: input.query.queryId,
        },
      }),
    );
    if (!kernelResult.ok) {
      throw kernelResult.error;
    }
    if (kernelResult.value.outcome !== 'AUTHORIZED') {
      return { ok: false, error: { code: 'KERNEL_REFUSED', decision: kernelResult.value } };
    }
    const executed = this.cleanRoom.executeAuthorizedQuery(
      kernelResult.value.authorization,
      gate.value,
      parsed.value,
      input.query,
      input.subjectRefs,
    );
    if (!executed.ok) {
      this.kernel.vault.seal(
        {
          kind: 'clean_room.denied',
          reason: executed.error.code,
          reasons: executed.error.reasons,
          queryHash: input.query.queryId,
          purpose: parsed.value.purpose,
          category: parsed.value.dataCategories[0],
        },
        asUtcInstant(input.occurredAt),
      );
      return { ok: false, error: executed.error };
    }
    this.kernel.vault.seal(
      {
        kind: 'clean_room.completed',
        queryId: input.query.queryId,
        purpose: parsed.value.purpose,
        category: parsed.value.dataCategories[0],
        cohortSize: executed.value.cohortSize,
        budgetConsumed: executed.value.budgetConsumed,
        resultHash: executed.value.resultHash,
        consentRefs: executed.value.consentRefs,
        rawRecordsReleased: false,
      },
      asUtcInstant(input.occurredAt),
    );
    return { ok: true, value: executed.value, kernel: kernelResult.value };
  }

  valueIndicative(input: ValuationInput): IndicativeCompensation {
    const model = this.models.get('indicative-data-compensation-v1');
    if (!model) {
      throw new Error('data valuation model is not registered');
    }
    return indicativeCompensation(model, input);
  }

  subjectRefs(count: number): readonly string[] {
    return syntheticSubjectRefs(count);
  }

  keyRefs(): Readonly<Record<PersonalDataCategory, string>> {
    const out = {} as Record<PersonalDataCategory, string>;
    for (const category of [
      'IDENTITY',
      'FINANCIAL',
      'HEALTH',
      'WELLNESS',
      'CONSUMPTION',
      'ENTERTAINMENT',
      'WORK',
      'LIFESTYLE',
      'GOALS',
      'PSYCHOLOGICAL',
      'PREFERENCES',
      'PURCHASE_INTENT',
    ] as const) {
      out[category] = this.vault.keyRef(category).keyId;
    }
    return Object.freeze(out);
  }

  private mustAuthorize(intent: ActionIntent): KernelAuthorization {
    const result = this.kernel.evaluate(intent);
    if (!result.ok) {
      throw result.error;
    }
    if (result.value.outcome !== 'AUTHORIZED') {
      throw new Error(
        `kernel refused ${intent.kind}: ${result.value.outcome} ${result.value.reasons.join('; ')}`,
      );
    }
    return result.value.authorization;
  }

  private intent(input: {
    readonly kind: ActionIntent['kind'];
    readonly actor: Actor;
    readonly occurredAt: string;
    readonly sourceJurisdiction: string;
    readonly payload: ActionIntent['payload'];
  }): ActionIntent {
    this.#seq += 1;
    return freezeIntent({
      id: asActionIntentId(`int_df_${String(this.#seq).padStart(6, '0')}`),
      kind: input.kind,
      actor: { ...input.actor, id: input.actor.id ?? asActorId('fabric') },
      payload: input.payload,
      idempotencyKey: asIdempotencyKey(`idem_df_${String(this.#seq).padStart(6, '0')}`),
      occurredAt: asUtcInstant(input.occurredAt),
      sourceJurisdiction: input.sourceJurisdiction,
    } as ActionIntent);
  }
}

export type { AccessRequest, PurposeAuthorization };
