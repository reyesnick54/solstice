import type { ConversationCatalog, EntityResolution, ResolvableEntity, SlotName, SlotQuestion, SlotValue } from './types.ts';

export function resolveEntityReference(
  catalog: ConversationCatalog,
  subjectId: string,
  slot: SlotName,
  reference: string,
): EntityResolution {
  const pool = poolFor(catalog, slot);
  const owned = pool.filter((item) => item.ownerSubjectId === subjectId);
  const cross = pool.filter((item) => item.ownerSubjectId !== subjectId && matches(item, reference));
  if (cross.length > 0 && owned.filter((item) => matches(item, reference)).length === 0) {
    return {
      ok: false,
      code: 'RESOURCE_NOT_OWNED',
      candidates: Object.freeze([]),
      question: {
        slot,
        prompt: 'That resource is not on your account. I will not use another customer\'s account.',
        reason: 'AMBIGUOUS',
      },
    };
  }
  const matchesFound = owned.filter((item) => matches(item, reference));
  if (matchesFound.length === 1) {
    return { ok: true, entity: matchesFound[0]!, ambiguous: false };
  }
  if (matchesFound.length > 1) {
    return {
      ok: false,
      code: 'ENTITY_AMBIGUOUS',
      candidates: Object.freeze(matchesFound),
      question: {
        slot,
        prompt: askAmbiguous(slot, matchesFound),
        reason: 'AMBIGUOUS',
      },
    };
  }
  if (owned.length === 1 && (slot === 'sourceAccount' || slot === 'card') && reference.trim().length === 0) {
    return { ok: true, entity: owned[0]!, ambiguous: false };
  }
  return {
    ok: false,
    code: 'ENTITY_NOT_FOUND',
    candidates: Object.freeze(owned),
    question: {
      slot,
      prompt: owned.length === 0
        ? `I do not have an authorized ${slot} to resolve "${reference}".`
        : askAmbiguous(slot, owned),
      reason: owned.length > 1 ? 'AMBIGUOUS' : 'REQUIRED',
    },
  };
}

export function resolveRequiredEntities(
  catalog: ConversationCatalog,
  subjectId: string,
  slots: Readonly<Record<string, SlotValue>>,
  names: readonly SlotName[],
):
  | { readonly ok: true; readonly slots: Readonly<Record<string, SlotValue>> }
  | { readonly ok: false; readonly questions: readonly SlotQuestion[] } {
  const next: Record<string, SlotValue> = { ...slots };
  const failures: SlotQuestion[] = [];
  for (const name of names) {
    const current = slots[name];
    if (!current) {
      continue;
    }
    if (current.resolvedId) {
      continue;
    }
    const resolved = resolveEntityReference(catalog, subjectId, name, current.raw);
    if (!resolved.ok) {
      failures.push(resolved.question);
      continue;
    }
    next[name] = Object.freeze({
      ...current,
      resolvedId: resolved.entity.id,
      displayLabel: resolved.entity.labels[0] ?? current.raw,
    });
  }
  if (failures.length > 0) {
    return { ok: false, questions: Object.freeze(failures) };
  }
  return { ok: true, slots: Object.freeze(next) };
}

function poolFor(catalog: ConversationCatalog, slot: SlotName): readonly ResolvableEntity[] {
  switch (slot) {
    case 'recipient':
    case 'destination':
      return catalog.beneficiaries;
    case 'sourceAccount':
    case 'destinationAccount':
      return catalog.accounts;
    case 'asset':
      return [...catalog.assets, ...catalog.holdings];
    case 'card':
      return catalog.cards;
    case 'goal':
      return catalog.goals;
    default:
      return [];
  }
}

function matches(entity: ResolvableEntity, reference: string): boolean {
  const needle = normalize(reference);
  if (entity.id === reference) {
    return true;
  }
  return entity.labels.some((label) => {
    const hay = normalize(label);
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function askAmbiguous(slot: SlotName, candidates: readonly ResolvableEntity[]): string {
  const labels = candidates.map((item) => item.labels[0] ?? item.id).join(', ');
  return `I found more than one match for ${slot}: ${labels}. Which one should I use? I will not choose arbitrarily.`;
}
