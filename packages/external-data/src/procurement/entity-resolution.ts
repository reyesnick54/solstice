/**
 * HELIOS ALT10 — procurement counterparty entity resolution (provider-neutral).
 */

import { createHash } from 'node:crypto';

import { PROCUREMENT_COUNTERPARTY_ROLES, type ProcurementCounterpartyRole } from './taxonomy.ts';
import type { ProcurementEntityBinding } from './types.ts';

export type ResolveProcurementCounterpartyInput = {
  readonly sourceLegalName: string;
  readonly role: ProcurementCounterpartyRole;
  readonly uei?: string | null;
  readonly cageCode?: string | null;
  readonly parentSourceLegalName?: string | null;
  readonly jointVenturePartnerNames?: readonly string[];
};

export function canonicalProcurementEntityId(material: string): string {
  const digest = createHash('sha256').update(material).digest('hex').slice(0, 20);
  return `govctr:${digest}`;
}

export function resolveProcurementCounterparty(input: ResolveProcurementCounterpartyInput): ProcurementEntityBinding {
  const role = assertCounterpartyRole(input.role);
  const normalizedName = input.sourceLegalName.trim().toUpperCase();
  const identifiers = [input.uei ?? '', input.cageCode ?? '', normalizedName, role].join('|');
  const canonicalEntityId = canonicalProcurementEntityId(identifiers);

  const parentCanonicalEntityId =
    input.parentSourceLegalName && role !== 'parent_company'
      ? canonicalProcurementEntityId(
          `${input.parentSourceLegalName.trim().toUpperCase()}|parent_company`,
        )
      : role === 'parent_company'
        ? canonicalEntityId
        : null;

  const jointVenturePartnerIds = Object.freeze(
    (input.jointVenturePartnerNames ?? []).map((name) =>
      canonicalProcurementEntityId(`${name.trim().toUpperCase()}|contractor`),
    ),
  );

  const bindingId = createHash('sha256')
    .update(`${canonicalEntityId}|${role}|${parentCanonicalEntityId ?? ''}`)
    .digest('hex')
    .slice(0, 16);

  return Object.freeze({
    bindingId,
    sourceLegalName: input.sourceLegalName,
    canonicalEntityId,
    role,
    parentCanonicalEntityId,
    jointVenturePartnerIds,
  });
}

/**
 * Attribution entity for economics on an award. Joint-venture awards attach to the JV;
 * they are never auto-attributed to the parent company.
 */
export function attributionEntityForAward(counterparty: ProcurementEntityBinding): string {
  if (counterparty.role === 'joint_venture') {
    return counterparty.canonicalEntityId;
  }
  if (counterparty.role === 'subsidiary') {
    return counterparty.canonicalEntityId;
  }
  if (counterparty.role === 'contractor') {
    return counterparty.canonicalEntityId;
  }
  if (counterparty.role === 'parent_company') {
    return counterparty.canonicalEntityId;
  }
  return counterparty.canonicalEntityId;
}

export function assertNoParentRollupForJointVenture(input: {
  readonly counterparty: ProcurementEntityBinding;
  readonly attributionEntityId: string;
}): boolean {
  if (input.counterparty.role !== 'joint_venture') {
    return true;
  }
  if (input.counterparty.parentCanonicalEntityId === null) {
    return input.attributionEntityId === input.counterparty.canonicalEntityId;
  }
  return (
    input.attributionEntityId === input.counterparty.canonicalEntityId &&
    input.attributionEntityId !== input.counterparty.parentCanonicalEntityId
  );
}

function assertCounterpartyRole(role: string): ProcurementCounterpartyRole {
  if (!(PROCUREMENT_COUNTERPARTY_ROLES as readonly string[]).includes(role)) {
    throw new Error(`PROCUREMENT_COUNTERPARTY_ROLE_INVALID:${role}`);
  }
  return role as ProcurementCounterpartyRole;
}
