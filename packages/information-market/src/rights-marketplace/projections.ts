import type { InformationRightsMarketplace } from './service.ts';
import type { InformationLicense, InformationRight } from './types.ts';

export type HinRightsView = {
  readonly schema: 'sunrey.consumer.hin.rights.v1';
  readonly items: readonly {
    readonly rightId: string;
    readonly category: string;
    readonly scope: string;
    readonly eligiblePurposes: readonly string[];
    readonly prohibitedPurposes: readonly string[];
    readonly status: string;
    readonly ownershipTransferred: false;
    readonly usageRightOnly: true;
    readonly termsVersion: string;
  }[];
  readonly productionActivated: false;
};

export type HinLicensesView = {
  readonly schema: 'sunrey.consumer.hin.licenses.v1';
  readonly items: readonly {
    readonly licenseId: string;
    readonly purpose: string;
    readonly scope: string;
    readonly status: string;
    readonly expiresAt: string | null;
    readonly redistribution: 'PROHIBITED';
  }[];
  readonly productionActivated: false;
};

export type HinPermissionsView = {
  readonly schema: 'sunrey.consumer.hin.permissions.v1';
  readonly items: readonly {
    readonly licenseId: string;
    readonly purpose: string;
    readonly status: string;
    readonly accessMode: string;
  }[];
  readonly howInformationIsUsed: readonly string[];
};

export type HinParticipationView = {
  readonly schema: 'sunrey.consumer.hin.participation.v1';
  readonly status: 'ACTIVE' | 'PAUSED' | 'WITHDRAWN';
  readonly compensationGuaranteed: false;
  readonly productionActivated: false;
};

export function projectRights(market: InformationRightsMarketplace, rightsHolder: string): HinRightsView {
  return Object.freeze({
    schema: 'sunrey.consumer.hin.rights.v1',
    items: Object.freeze(market.rightsFor(rightsHolder).map(projectRight)),
    productionActivated: false,
  });
}

export function projectLicenses(market: InformationRightsMarketplace, rightsHolder: string): HinLicensesView {
  return Object.freeze({
    schema: 'sunrey.consumer.hin.licenses.v1',
    items: Object.freeze(market.licensesForHolder(rightsHolder).map(projectLicense)),
    productionActivated: false,
  });
}

export function projectPermissions(market: InformationRightsMarketplace, rightsHolder: string): HinPermissionsView {
  const licenses = market.licensesForHolder(rightsHolder);
  return Object.freeze({
    schema: 'sunrey.consumer.hin.permissions.v1',
    items: Object.freeze(
      licenses.map((license) => {
        const product = market.store.products.get(license.productId);
        return Object.freeze({
          licenseId: license.licenseId,
          purpose: license.purpose,
          status: license.status,
          accessMode: product?.accessMode ?? 'APPROVED_QUERY',
        });
      }),
    ),
    howInformationIsUsed: Object.freeze(licenses.filter((row) => row.status === 'ACTIVE').map((row) => row.purpose)),
  });
}

export function projectParticipation(market: InformationRightsMarketplace, rightsHolder: string): HinParticipationView {
  return Object.freeze({
    schema: 'sunrey.consumer.hin.participation.v1',
    status: market.store.participation.get(rightsHolder) ?? 'ACTIVE',
    compensationGuaranteed: false,
    productionActivated: false,
  });
}

function projectRight(right: InformationRight) {
  return Object.freeze({
    rightId: right.rightId,
    category: right.underlyingCategory,
    scope: right.scope,
    eligiblePurposes: right.eligiblePurposes,
    prohibitedPurposes: right.prohibitedPurposes,
    status: right.status,
    ownershipTransferred: false as const,
    usageRightOnly: true as const,
    termsVersion: right.termsVersion,
  });
}

function projectLicense(license: InformationLicense) {
  return Object.freeze({
    licenseId: license.licenseId,
    purpose: license.purpose,
    scope: license.scope,
    status: license.status,
    expiresAt: license.expiresAt,
    redistribution: 'PROHIBITED' as const,
  });
}
