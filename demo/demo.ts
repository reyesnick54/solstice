import {
  ACCOUNT_CLASSES,
  CustomerPosition,
  InMemoryPostingStore,
  Money,
  accountId,
  balanceOfAccount,
  createAccount,
  customerId,
  formatMoney,
  postingId,
  projectCustomerPosition,
  type Account,
  type FxConversion,
} from "../src/index.ts";

function usd(minor: bigint): Money {
  return Money.of(minor, "USD");
}

function eur(minor: bigint): Money {
  return Money.of(minor, "EUR");
}

function line(label: string, amount: Money, tags: string): string {
  const padded = label.padEnd(16);
  const tag = tags.padEnd(22);
  return `  ${padded} ${tag} ${formatMoney(amount)}`;
}

const owner = customerId("cust_demo");
const store = new InMemoryPostingStore();

const accounts: Account[] = [
  createAccount({
    id: accountId("acct_deposits"),
    customerId: owner,
    accountClass: "deposits",
    currency: "USD",
  }),
  createAccount({
    id: accountId("acct_investments"),
    customerId: owner,
    accountClass: "investments",
    currency: "USD",
  }),
  createAccount({
    id: accountId("acct_digital"),
    customerId: owner,
    accountClass: "digital_assets",
    currency: "USD",
  }),
  createAccount({
    id: accountId("acct_rewards"),
    customerId: owner,
    accountClass: "rewards",
    currency: "USD",
  }),
  createAccount({
    id: accountId("acct_pending"),
    customerId: owner,
    accountClass: "pending",
    currency: "USD",
  }),
  createAccount({
    id: accountId("acct_empty"),
    customerId: owner,
    accountClass: "deposits",
    currency: "USD",
  }),
];

const [deposits, investments, digital, rewards, pending, emptyDeposits] =
  accounts;

if (
  !deposits ||
  !investments ||
  !digital ||
  !rewards ||
  !pending ||
  !emptyDeposits
) {
  throw new Error("demo accounts missing");
}

let n = 0;
function record(account: Account, amount: Money): void {
  n += 1;
  store.record({
    id: postingId(`demo_${n}`),
    accountId: account.id,
    customerId: account.customerId,
    amount,
    postedAt: new Date("2026-08-01T00:00:00.000Z"),
  });
}

record(deposits, usd(150_000n));
record(deposits, usd(25_000n));
record(investments, usd(40_000n));
record(digital, usd(10_000n));
record(rewards, usd(2_500n));
record(pending, usd(1_250n));

console.log("=== Solstice Balance Projection (read-only, from ledger postings) ===\n");

const emptyBalance = balanceOfAccount(store, emptyDeposits);
if (!emptyBalance.ok) {
  throw new Error(emptyBalance.error.message);
}
console.log(`Account with no postings (${emptyDeposits.id}): ${formatMoney(emptyBalance.value)}`);

const several = balanceOfAccount(store, deposits);
if (!several.ok) {
  throw new Error(several.error.message);
}
console.log(`Deposits account after several credits: ${formatMoney(several.value)}\n`);

const position = projectCustomerPosition({
  query: store,
  customerId: owner,
  accounts,
  homeCurrency: "USD",
});
if (!position.ok) {
  throw new Error(position.error.message);
}

printPosition("USD-only customer", position.value);

const eurInvestments = createAccount({
  id: accountId("acct_eur_invest"),
  customerId: owner,
  accountClass: "investments",
  currency: "EUR",
});
store.record({
  id: postingId("demo_eur"),
  accountId: eurInvestments.id,
  customerId: owner,
  amount: eur(20_000n),
  postedAt: new Date("2026-08-02T00:00:00.000Z"),
});

const mixedWithoutRate = projectCustomerPosition({
  query: store,
  customerId: owner,
  accounts: [...accounts, eurInvestments],
  homeCurrency: "USD",
});
console.log("Mixed currencies without a rate:");
if (mixedWithoutRate.ok) {
  throw new Error("expected MixedCurrencyWithoutConversion");
}
console.log(`  ${mixedWithoutRate.error.type}`);
console.log(`  currencies: ${mixedWithoutRate.error.currencies.join(", ")}`);
console.log(`  ${mixedWithoutRate.error.message}\n`);

const conversion: FxConversion = {
  from: "EUR",
  to: "USD",
  rate: { numerator: 11n, denominator: 10n },
  timestamp: new Date("2026-08-13T15:00:00.000Z"),
};

const mixedWithRate = projectCustomerPosition({
  query: store,
  customerId: owner,
  accounts: [...accounts, eurInvestments],
  homeCurrency: "USD",
  conversion,
});
if (!mixedWithRate.ok) {
  throw new Error(mixedWithRate.error.message);
}
printPosition(
  "mixed currencies with explicit EUR→USD 11/10 at 2026-08-13T15:00:00.000Z",
  mixedWithRate.value,
);

console.log("Account classes (exhaustive):", ACCOUNT_CLASSES.join(", "));
console.log("Ledger posting count (unchanged by projection):", store.postingCount);

function printPosition(title: string, value: CustomerPosition): void {
  console.log(`--- ${title} ---`);
  console.log("Per-class breakdown (legally distinct; insured vs at-risk never blended without this table):");
  for (const accountClass of ACCOUNT_CLASSES) {
    const row = value.breakdown[accountClass];
    const tags = `${row.classification.insurance} / ${row.classification.realization}`;
    console.log(line(accountClass, row.total, tags));
  }
  console.log("");
  console.log(`Total Solstice Wealth: ${formatMoney(value.grandTotal)}`);
  console.log("  (grand total is inseparable from the breakdown above;");
  console.log("   converting this total into a percentage investment return is architecturally forbidden)");
  console.log("");
}
