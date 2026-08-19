import { Money } from '../../money/src/money.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { toolIntentIdFor } from './ids.ts';
import { isForbiddenAiTool, isAiToolIntentName } from './taxonomy.ts';
import type { AiFailureCode, AiProviderKind } from './taxonomy.ts';
import type {
  AiInferenceRequest,
  AiMoneyQuantity,
  AiProviderFailure,
  AiStructuredOutput,
  AiToolIntent,
} from './types.ts';

const INTEGER_STRING = /^-?\d+$/;

export function parseMoneyQuantity(
  value: unknown,
  field: string,
): Result<AiMoneyQuantity, AiProviderFailure> {
  if (!value || typeof value !== 'object') {
    return fail('INVALID_STRUCTURED_OUTPUT', `${field} must be an object`);
  }
  const record = value as Record<string, unknown>;
  if (typeof record.minorUnits === 'number' || typeof record.currency === 'number') {
    return fail('FLOATING_POINT_MONEY_FORBIDDEN', `${field} must not use floating-point or number money`);
  }
  if (typeof record.minorUnits !== 'string' || !INTEGER_STRING.test(record.minorUnits)) {
    return fail('FLOATING_POINT_MONEY_FORBIDDEN', `${field}.minorUnits must be a signed integer string`);
  }
  if (typeof record.currency !== 'string' || record.currency.length === 0) {
    return fail('INVALID_STRUCTURED_OUTPUT', `${field}.currency is required`);
  }
  try {
    Money.fromMinorUnitsString(record.minorUnits, record.currency);
  } catch {
    return fail('FLOATING_POINT_MONEY_FORBIDDEN', `${field} is not a canonical integer money quantity`);
  }
  return ok(Object.freeze({ minorUnits: record.minorUnits, currency: record.currency }));
}

export function parseStructuredOutput(
  value: unknown,
): Result<AiStructuredOutput, AiProviderFailure> {
  if (!value || typeof value !== 'object') {
    return fail('INVALID_STRUCTURED_OUTPUT', 'structured output must be an object');
  }
  const record = value as Record<string, unknown>;
  if (record.guaranteedReturn !== false) {
    return fail('INVALID_STRUCTURED_OUTPUT', 'structured output must set guaranteedReturn=false');
  }
  if (record.kind === 'EXPLANATION') {
    if (typeof record.text !== 'string' || record.text.length === 0) {
      return fail('INVALID_STRUCTURED_OUTPUT', 'EXPLANATION.text is required');
    }
    return ok(Object.freeze({ kind: 'EXPLANATION', text: record.text, guaranteedReturn: false as const }));
  }
  if (record.kind === 'FINANCIAL_PROPOSAL') {
    if (
      record.action !== 'PREPARE_PAYMENT' &&
      record.action !== 'PREPARE_EXCHANGE_ORDER' &&
      record.action !== 'PREPARE_REBALANCE'
    ) {
      return fail('INVALID_STRUCTURED_OUTPUT', 'FINANCIAL_PROPOSAL.action must be a prepare intent');
    }
    if (typeof record.assetId !== 'string' || record.assetId.length === 0) {
      return fail('INVALID_STRUCTURED_OUTPUT', 'FINANCIAL_PROPOSAL.assetId is required');
    }
    if (typeof record.destinationOrMarket !== 'string' || record.destinationOrMarket.length === 0) {
      return fail('INVALID_STRUCTURED_OUTPUT', 'FINANCIAL_PROPOSAL.destinationOrMarket is required');
    }
    if (typeof record.operationalRationale !== 'string' || record.operationalRationale.length === 0) {
      return fail('INVALID_STRUCTURED_OUTPUT', 'FINANCIAL_PROPOSAL.operationalRationale is required');
    }
    const quantity = parseMoneyQuantity(record.quantity, 'quantity');
    if (!quantity.ok) {
      return quantity;
    }
    const fees = parseMoneyQuantity(record.fees, 'fees');
    if (!fees.ok) {
      return fees;
    }
    return ok(
      Object.freeze({
        kind: 'FINANCIAL_PROPOSAL',
        action: record.action,
        assetId: record.assetId,
        quantity: quantity.value,
        destinationOrMarket: record.destinationOrMarket,
        fees: fees.value,
        operationalRationale: record.operationalRationale,
        guaranteedReturn: false as const,
      }),
    );
  }
  return fail('INVALID_STRUCTURED_OUTPUT', 'structured output kind is missing or unsupported');
}

export function parseToolIntents(
  request: AiInferenceRequest,
  value: unknown,
): Result<readonly AiToolIntent[], AiProviderFailure> {
  if (value === undefined) {
    return ok(Object.freeze([]));
  }
  if (!Array.isArray(value)) {
    return fail('INVALID_STRUCTURED_OUTPUT', 'toolIntents must be an array');
  }
  const intents: AiToolIntent[] = [];
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== 'object') {
      return fail('INVALID_STRUCTURED_OUTPUT', `toolIntents[${String(index)}] is not an object`);
    }
    const record = item as Record<string, unknown>;
    if (isForbiddenAiTool(record.name)) {
      return fail('FORBIDDEN_TOOL_REQUESTED', `${String(record.name)} is not an exposed AI tool`);
    }
    if (!isAiToolIntentName(record.name)) {
      return fail('INVALID_STRUCTURED_OUTPUT', `toolIntents[${String(index)}].name is not a bounded intent`);
    }
    if (record.executes === true) {
      return fail('FORBIDDEN_TOOL_REQUESTED', 'tool intents cannot mark themselves executable');
    }
    let quantity: AiMoneyQuantity | null = null;
    if (record.quantity !== undefined && record.quantity !== null) {
      const parsed = parseMoneyQuantity(record.quantity, `toolIntents[${String(index)}].quantity`);
      if (!parsed.ok) {
        return parsed;
      }
      quantity = parsed.value;
    }
    let fees: AiMoneyQuantity | null = null;
    if (record.fees !== undefined && record.fees !== null) {
      const parsed = parseMoneyQuantity(record.fees, `toolIntents[${String(index)}].fees`);
      if (!parsed.ok) {
        return parsed;
      }
      fees = parsed.value;
    }
    intents.push(
      Object.freeze({
        intentId: toolIntentIdFor(request.requestId, record.name, index),
        name: record.name,
        rationale: typeof record.rationale === 'string' ? record.rationale : 'unspecified',
        assetId: typeof record.assetId === 'string' ? record.assetId : null,
        quantity,
        destinationOrMarket: typeof record.destinationOrMarket === 'string' ? record.destinationOrMarket : null,
        fees,
        executes: false,
      }),
    );
  }
  return ok(Object.freeze(intents));
}

export function structuredProposalToToolIntent(
  request: AiInferenceRequest,
  structured: Extract<AiStructuredOutput, { kind: 'FINANCIAL_PROPOSAL' }>,
): AiToolIntent {
  return Object.freeze({
    intentId: toolIntentIdFor(request.requestId, structured.action, 0),
    name: structured.action,
    rationale: structured.operationalRationale,
    assetId: structured.assetId,
    quantity: structured.quantity,
    destinationOrMarket: structured.destinationOrMarket,
    fees: structured.fees,
    executes: false,
  });
}

function fail(code: AiFailureCode, detail: string, providerKind: AiProviderKind | null = 'LOCAL_TEST'): Result<never, AiProviderFailure> {
  return err({ ok: false, code, detail, providerKind });
}
