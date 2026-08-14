import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { EconomicDeltaHasNoReturnMetrics } from '../packages/platform/src/growth/GrowthAttributionLedger.ts';
import type { MoneyHasNoReturnMetrics } from '../packages/contracts/src/money.ts';
import { GrowthAttributionLedger } from '../packages/platform/src/growth/GrowthAttributionLedger.ts';
import { asCustomerId, asEventId } from '../packages/contracts/src/ids.ts';
import { asUtcInstant } from '../packages/contracts/src/time.ts';
import { Money } from '../packages/contracts/src/money.ts';
import { GROWTH_SOURCES } from '../packages/contracts/src/growth-catalog.ts';

const ROOT = new URL('..', import.meta.url).pathname;

const FORBIDDEN = [
  'percentageReturn',
  'percentReturn',
  'blendedYield',
  'growthRate',
  'rateOfReturn',
  'annualizedReturn',
  'returnRate',
] as const;

const SKIP_DIR = new Set(['node_modules', '.git', 'dist']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (name.endsWith('.ts') || name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

describe('no percentage-return path', () => {
  it('production TypeScript contains no percentage-return identifiers', () => {
    const files = walk(join(ROOT, 'packages')).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    );
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const needle of FORBIDDEN) {
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          if (!line.includes(needle)) return;
          // Quoted lock-out unions, grep needles, and regex guards are not code paths.
          if (
            line.includes(`'${needle}'`) ||
            line.includes(`"${needle}"`) ||
            line.includes('Forbidden') ||
            line.includes('FORBIDDEN') ||
            /\.test\(/.test(line) ||
            line.includes('.includes(')
          ) {
            return;
          }
          hits.push(`${relative(ROOT, file)}:${i + 1} ${line.trim()}`);
        });
      }
    }
    assert.deepEqual(hits, []);
  });

  it('EconomicDelta and Money expose no return-metric keys', () => {
    const a: EconomicDeltaHasNoReturnMetrics = true;
    const b: MoneyHasNoReturnMetrics = true;
    assert.equal(a, true);
    assert.equal(b, true);
  });

  it('weekly summary JSON has no percent sign and no yield field', () => {
    const gal = new GrowthAttributionLedger();
    const customerId = asCustomerId('cust_pct');
    for (const source of GROWTH_SOURCES) {
      gal.record({
        customerId,
        source,
        amount: Money.fromMinorUnits(100n, 'USD'),
        originatingEventId: asEventId(`evt_${source}`),
        recordedAt: asUtcInstant('2026-08-10T00:00:00.000Z'),
      });
    }
    const weekly = gal.summarize({
      customerId,
      period: 'WEEKLY',
      from: asUtcInstant('2026-08-06T00:00:00.000Z'),
      to: asUtcInstant('2026-08-13T00:00:00.000Z'),
      currency: 'USD',
    });
    const json = JSON.stringify(weekly);
    assert.equal(json.includes('%'), false);
    assert.equal('percentageReturn' in weekly, false);
    assert.equal('blendedYield' in weekly, false);
    assert.equal('growthRate' in weekly, false);
    assert.equal('income' in weekly, false);
    assert.equal('yield' in weekly, false);
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customerId } from "../src/account.ts";
import {
  projectCustomerPosition,
  type CustomerPosition,
  type CustomerPositionHasNoReturnMetrics,
  type ForbiddenReturnMetricKeys,
} from "../src/balances.ts";
import { InMemoryPostingStore } from "../src/ledger.ts";
import { openAccount, post, usd } from "./fixtures.ts";

const FORBIDDEN: readonly ForbiddenReturnMetricKeys[] = [
  "percentageReturn",
  "percentReturn",
  "yield",
  "apy",
  "apr",
  "growthRate",
  "returnRate",
  "blendedYield",
  "rateOfReturn",
];

describe("no percentage-return property", () => {
  it("the returned type exposes no percentage-return property", () => {
    const _typeLock: CustomerPositionHasNoReturnMetrics = true;
    assert.equal(_typeLock, true);

    const store = new InMemoryPostingStore();
    const owner = customerId("cust_no_yield");
    const deposits = openAccount({
      customerId: owner,
      accountClass: "deposits",
    });
    post(store, deposits, usd(1_000n));

    const result = projectCustomerPosition({
      query: store,
      customerId: owner,
      accounts: [deposits],
      homeCurrency: "USD",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;

    const position: CustomerPosition = result.value;
    const ownKeys = [
      ...Object.keys(position),
      ...Object.getOwnPropertyNames(position),
      ...Object.keys(Object.getPrototypeOf(position) as object),
    ];
    const breakdownKeys = Object.keys(position.breakdown);
    const classTotalKeys = Object.values(position.breakdown).flatMap((row) =>
      Object.keys(row),
    );

    for (const key of FORBIDDEN) {
      assert.equal(
        ownKeys.includes(key),
        false,
        `CustomerPosition must not expose ${key}`,
      );
      assert.equal(
        breakdownKeys.includes(key),
        false,
        `breakdown must not expose ${key}`,
      );
      assert.equal(
        classTotalKeys.includes(key),
        false,
        `class total must not expose ${key}`,
      );
      assert.equal(key in position, false);
      assert.equal(key in position.breakdown, false);
    }

    assert.equal("percentageReturn" in position, false);
    assert.equal("yield" in position, false);
    assert.equal("growthRate" in position, false);
  });
});
