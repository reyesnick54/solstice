import type {
  InvestmentAccountPreconditions,
  MissingInvestmentPrecondition,
} from '../../contracts/src/investment-types.ts';

export type PreconditionCheck =
  | { readonly ok: true; readonly preconditions: InvestmentAccountPreconditions }
  | { readonly ok: false; readonly missing: MissingInvestmentPrecondition };

export function checkInvestmentPreconditions(input: {
  readonly agreementVersion?: string;
  readonly riskProfileCurrent?: boolean;
  readonly disclosureVersion?: string;
  readonly transferAuthorized?: boolean;
  readonly preconditions?: InvestmentAccountPreconditions;
}): PreconditionCheck {
  if (input.preconditions) {
    return { ok: true, preconditions: input.preconditions };
  }
  if (!input.agreementVersion || input.agreementVersion.length === 0) {
    return { ok: false, missing: 'MISSING_INVESTMENT_ACCOUNT_AGREEMENT' };
  }
  if (input.riskProfileCurrent !== true) {
    return { ok: false, missing: 'MISSING_CURRENT_RISK_PROFILE' };
  }
  if (!input.disclosureVersion || input.disclosureVersion.length === 0) {
    return { ok: false, missing: 'MISSING_CURRENT_DISCLOSURE' };
  }
  if (input.transferAuthorized !== true) {
    return { ok: false, missing: 'MISSING_CUSTOMER_TRANSFER_AUTHORIZATION' };
  }
  return { ok: false, missing: 'MISSING_INVESTMENT_ACCOUNT_AGREEMENT' };
}

export function missingFromPartial(partial: {
  readonly agreement?: unknown;
  readonly riskProfile?: unknown;
  readonly disclosure?: unknown;
  readonly transferAuthorization?: unknown;
}): MissingInvestmentPrecondition | null {
  if (partial.agreement === undefined || partial.agreement === null) {
    return 'MISSING_INVESTMENT_ACCOUNT_AGREEMENT';
  }
  if (partial.riskProfile === undefined || partial.riskProfile === null) {
    return 'MISSING_CURRENT_RISK_PROFILE';
  }
  if (partial.disclosure === undefined || partial.disclosure === null) {
    return 'MISSING_CURRENT_DISCLOSURE';
  }
  if (
    partial.transferAuthorization === undefined ||
    partial.transferAuthorization === null
  ) {
    return 'MISSING_CUSTOMER_TRANSFER_AUTHORIZATION';
  }
  return null;
}
