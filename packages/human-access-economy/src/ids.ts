import { randomUUID } from 'node:crypto';

export function newAccessIntentId(): string {
  return `acc_int_${randomUUID()}`;
}

export function newAccessQuoteId(): string {
  return `acc_qte_${randomUUID()}`;
}

export function newAccessReservationId(): string {
  return `acc_rsv_${randomUUID()}`;
}

export function newAccessExperienceId(): string {
  return `acc_exp_${randomUUID()}`;
}

export function newAccessEntitlementId(): string {
  return `acc_ent_${randomUUID()}`;
}

export function newAccessActivityId(): string {
  return `acc_act_${randomUUID()}`;
}
