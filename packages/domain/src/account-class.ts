/**
 * Money classes are absolute. Insured deposits, investment assets, digital
 * assets, rewards, and pending earnings never share an account or a ledger
 * posting class.
 */
export const ACCOUNT_CLASSES = [
  'INSURED_DEPOSIT',
  'INVESTMENT_ASSET',
  'DIGITAL_ASSET',
  'REWARD',
  'PENDING_EARNING',
] as const;

export type AccountClass = (typeof ACCOUNT_CLASSES)[number];

export function isAccountClass(value: unknown): value is AccountClass {
  return (
    typeof value === 'string' && (ACCOUNT_CLASSES as readonly string[]).includes(value)
  );
}
