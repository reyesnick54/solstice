import { err, ok, type Result } from '../../domain/src/result.ts';
import type { CreateBeneficiaryPayload } from '../../permissions/src/action-types.ts';
import { sha256Hex } from '../../security/src/hash.ts';
import type { AccountCoordinateRef } from './beneficiary.ts';

export type BeneficiaryValidationFailure = {
  readonly code:
    | 'BENEFICIARY_FIELDS_REQUIRED'
    | 'BENEFICIARY_COORDINATE_INVALID'
    | 'BENEFICIARY_COUNTRY_CURRENCY_UNSUPPORTED'
    | 'BENEFICIARY_OWNERSHIP_MISMATCH';
  readonly message: string;
};

export type BeneficiaryValidationPort = {
  validate(
    payload: CreateBeneficiaryPayload,
    ownerId: string,
  ): Result<AccountCoordinateRef, BeneficiaryValidationFailure>;
};

const SUPPORTED_COUNTRY_CURRENCY: Readonly<Record<string, readonly string[]>> = {
  SA: ['SAR'],
  US: ['USD'],
  GB: ['GBP', 'USD'],
  AE: ['AED'],
  DE: ['EUR'],
  FR: ['EUR'],
  IE: ['EUR'],
};

const COORDINATE_SCHEMES: Readonly<Record<string, RegExp>> = {
  SA_IBAN: /^SA\d{22}$/,
  US_ABA: /^\d{9}:\d{4,17}$/,
  GB_SORT: /^\d{6}:\d{8}$/,
  AE_IBAN: /^AE\d{21}$/,
  IBAN: /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/,
  SUNREY_ACCOUNT: /^[A-Za-z0-9_.:-]{4,128}$/,
  WALLET_REF: /^[A-Z]{2,12}:[A-Za-z0-9_-]{4,64}$/,
};

/**
 * Simulation validator. Later adapters can add confirmation-of-payee.
 * Does not contact a real bank.
 */
export class SimulationBeneficiaryValidator implements BeneficiaryValidationPort {
  validate(
    payload: CreateBeneficiaryPayload,
    ownerId: string,
  ): Result<AccountCoordinateRef, BeneficiaryValidationFailure> {
    if (payload.ownerId !== ownerId) {
      return fail('BENEFICIARY_OWNERSHIP_MISMATCH', 'beneficiary owner does not match the actor customer');
    }
    if (payload.legalName.trim().length === 0) {
      return fail('BENEFICIARY_FIELDS_REQUIRED', 'legal name is required');
    }
    if (payload.kind !== 'PERSON' && payload.kind !== 'BUSINESS') {
      return fail('BENEFICIARY_FIELDS_REQUIRED', 'kind must be PERSON or BUSINESS');
    }
    const allowed = SUPPORTED_COUNTRY_CURRENCY[payload.destinationCountry];
    if (!allowed || !allowed.includes(payload.currency)) {
      return fail(
        'BENEFICIARY_COUNTRY_CURRENCY_UNSUPPORTED',
        `country ${payload.destinationCountry} does not support ${payload.currency} in simulation`,
      );
    }
    const scheme = payload.accountCoordinate.scheme;
    const value = payload.accountCoordinate.value.replace(/\s+/g, '');
    const pattern = COORDINATE_SCHEMES[scheme];
    if (!pattern || !pattern.test(value)) {
      return fail(
        'BENEFICIARY_COORDINATE_INVALID',
        `account coordinate does not match scheme ${scheme}`,
      );
    }
    return ok(
      Object.freeze({
        scheme,
        coordinateRef: sha256Hex(`coord:${scheme}:${value}`),
        displayHint: scheme === 'SUNREY_ACCOUNT' ? value : value.slice(-4),
      }),
    );
  }
}

function fail(
  code: BeneficiaryValidationFailure['code'],
  message: string,
): Result<AccountCoordinateRef, BeneficiaryValidationFailure> {
  return err(Object.freeze({ code, message }));
}
