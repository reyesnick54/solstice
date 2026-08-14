import { err, ok, type Result } from '../../../contracts/src/result.ts';
import { Money, type RationalShare } from '../../../contracts/src/money.ts';
import { asMandateClauseId, asMandateId } from '../../../contracts/src/ids.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import {
  isRiskCeiling,
  riskRank,
  type RiskCeiling,
} from '../../../contracts/src/account-class.ts';
import type { CapabilityTokenClaims } from '../../../contracts/src/capability-claims.ts';
import type {
  CompiledMandate,
  MandateCompileFailure,
  MandateConstraint,
} from '../../../contracts/src/mandate-types.ts';
import { KNOWN_MANDATE_TEMPLATES } from '../../../contracts/src/mandate-types.ts';
import type { ProposalActionType } from '../../../contracts/src/proposal-types.ts';

const TEMPLATES_HELP = KNOWN_MANDATE_TEMPLATES.map((t) => `"${t}"`).join('; ');

function shareFromWholePercent(whole: bigint): Result<RationalShare, MandateCompileFailure> {
  if (whole < 0n || whole > 100n) {
    return err({
      code: 'MANDATE_UNCOMPILABLE',
      sourceText: '',
      explanation: `Share ${whole.toString()} is outside 0–100 and cannot be compiled.`,
    });
  }
  return ok({ numerator: whole, denominator: 100n });
}

function parseDollarAmount(raw: string, currency: string): Money {
  const digits = raw.replace(/,/g, '');
  if (!/^\d+$/.test(digits)) {
    throw new Error('invalid dollar amount');
  }
  return Money.fromMinorUnits(BigInt(digits) * 100n, currency);
}

const MONTH_WORDS: { readonly [word: string]: bigint } = {
  one: 1n,
  two: 2n,
  three: 3n,
  four: 4n,
  five: 5n,
  six: 6n,
  seven: 7n,
  eight: 8n,
  nine: 9n,
  ten: 10n,
  twelve: 12n,
};

function parseMonths(raw: string): bigint | null {
  const lower = raw.toLowerCase();
  if (MONTH_WORDS[lower] !== undefined) {
    return MONTH_WORDS[lower];
  }
  if (/^\d+$/.test(raw)) {
    return BigInt(raw);
  }
  return null;
}

type Parsed = {
  readonly constraint: MandateConstraint;
  readonly requiredProposalTypes: readonly ProposalActionType[];
};

function parseDeterministic(text: string, currency: string): Result<Parsed, MandateCompileFailure> {
  const normalized = text.trim().replace(/\s+/g, ' ');

  const keepLiquid = /^keep \$([0-9,]+) liquid$/i.exec(normalized);
  if (keepLiquid) {
    try {
      const amount = parseDollarAmount(keepLiquid[1]!, currency);
      return ok({
        constraint: { kind: 'KEEP_LIQUID', amount },
        requiredProposalTypes: ['HOLD_LIQUIDITY'],
      });
    } catch {
      return uncompilable(text, `Could not parse liquid amount "${keepLiquid[1]}".`);
    }
  }

  const reserve = /^maintain ([A-Za-z]+|\d+) months? of expenses as reserves$/i.exec(
    normalized,
  );
  if (reserve) {
    const months = parseMonths(reserve[1]!);
    if (months === null || months <= 0n) {
      return uncompilable(text, `Could not parse reserve months "${reserve[1]}".`);
    }
    return ok({
      constraint: { kind: 'RESERVE_MONTHS', months },
      requiredProposalTypes: ['ALLOCATE_TO_RESERVE'],
    });
  }

  if (/^invest surplus cash$/i.test(normalized)) {
    return ok({
      constraint: { kind: 'INVEST_SURPLUS' },
      requiredProposalTypes: ['INVESTMENT_SWEEP'],
    });
  }

  const risk = /^never exceed (conservative|moderate|aggressive) risk$/i.exec(normalized);
  if (risk) {
    const max = risk[1]!.toUpperCase() as RiskCeiling;
    if (!isRiskCeiling(max)) {
      return uncompilable(text, `Unknown risk ceiling "${risk[1]}".`);
    }
    return ok({
      constraint: { kind: 'RISK_CEILING', max },
      requiredProposalTypes: [],
    });
  }

  const reinvest = /^reinvest (\d+)% of realized gains$/i.exec(normalized);
  if (reinvest) {
    const share = shareFromWholePercent(BigInt(reinvest[1]!));
    if (!share.ok) {
      return err({ ...share.error, sourceText: text });
    }
    return ok({
      constraint: { kind: 'REINVEST_REALIZED_GAINS', share: share.value },
      requiredProposalTypes: ['REINVEST_REALIZED_GAINS'],
    });
  }

  const toSavings = /^move (\d+)% of realized gains to savings weekly$/i.exec(normalized);
  if (toSavings) {
    const share = shareFromWholePercent(BigInt(toSavings[1]!));
    if (!share.ok) {
      return err({ ...share.error, sourceText: text });
    }
    return ok({
      constraint: { kind: 'WEEKLY_GAINS_TO_SAVINGS', share: share.value },
      requiredProposalTypes: ['TRANSFER_REALIZED_GAINS_TO_SAVINGS'],
    });
  }

  const research = /^show me research opportunities paying more than \$([0-9,]+)$/i.exec(
    normalized,
  );
  if (research) {
    try {
      const minCompensation = parseDollarAmount(research[1]!, currency);
      return ok({
        constraint: { kind: 'RESEARCH_PAY_FLOOR', minCompensation },
        requiredProposalTypes: ['SHOW_RESEARCH_OPPORTUNITY'],
      });
    } catch {
      return uncompilable(text, `Could not parse compensation floor "${research[1]}".`);
    }
  }

  return uncompilable(
    text,
    `This mandate cannot be compiled deterministically. Known templates: ${TEMPLATES_HELP}. Free-form language is never approximated or interpreted at evaluation time.`,
  );
}

function uncompilable(sourceText: string, explanation: string): Result<Parsed, MandateCompileFailure> {
  return err({
    code: 'MANDATE_UNCOMPILABLE',
    sourceText,
    explanation,
  });
}

/**
 * A mandate may only narrow token authority. Required proposal types must
 * already be allowed. A risk ceiling may not exceed the token's maxRisk.
 * Limits cannot be raised.
 */
function assertNarrowsToken(
  parsed: Parsed,
  claims: CapabilityTokenClaims,
  sourceText: string,
): Result<void, MandateCompileFailure> {
  for (const actionType of parsed.requiredProposalTypes) {
    if (!claims.allowedProposalTypes.includes(actionType)) {
      return err({
        code: 'MANDATE_WIDENS_TOKEN',
        sourceText,
        explanation: `Mandate would require proposal type ${actionType}, which the capability token does not grant. Mandates may only narrow authority.`,
      });
    }
  }

  if (parsed.constraint.kind === 'RISK_CEILING') {
    if (riskRank(parsed.constraint.max) > riskRank(claims.maxRisk)) {
      return err({
        code: 'MANDATE_WIDENS_TOKEN',
        sourceText,
        explanation: `Mandate risk ceiling ${parsed.constraint.max} exceeds token maxRisk ${claims.maxRisk}. Mandates may only narrow authority.`,
      });
    }
  }

  if (parsed.constraint.kind === 'KEEP_LIQUID') {
    if (parsed.constraint.amount.currency !== claims.perTransactionLimit.currency) {
      return err({
        code: 'MANDATE_UNCOMPILABLE',
        sourceText,
        explanation: 'Liquid floor currency does not match the capability token currency.',
      });
    }
  }

  return ok(undefined);
}

export type CompileMandateInput = {
  readonly customerId: string;
  readonly sourceText: string;
  readonly claims: CapabilityTokenClaims;
  readonly currency: string;
  readonly compiledAt: UtcInstant;
  readonly version: number;
  readonly mandateId?: string;
};

export function compileMandate(
  input: CompileMandateInput,
): Result<CompiledMandate, MandateCompileFailure> {
  const parsed = parseDeterministic(input.sourceText, input.currency);
  if (!parsed.ok) {
    return parsed;
  }

  const narrowing = assertNarrowsToken(parsed.value, input.claims, input.sourceText);
  if (!narrowing.ok) {
    return narrowing;
  }

  const mandate: CompiledMandate = Object.freeze({
    id: asMandateId(input.mandateId ?? `man_${input.version}_${input.customerId}`),
    customerId: input.customerId,
    version: input.version,
    sourceText: input.sourceText.trim().replace(/\s+/g, ' '),
    clauseId: asMandateClauseId(`clause_${input.version}`),
    constraint: Object.freeze(parsed.value.constraint) as MandateConstraint,
    requiredProposalTypes: Object.freeze([...parsed.value.requiredProposalTypes]),
    compiledAt: input.compiledAt,
  });

  return ok(mandate);
}
