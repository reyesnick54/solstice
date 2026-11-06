import type { ComparableMultipleKind } from './taxonomy.ts';
import type { PeerCandidate } from './types.ts';

export type MultipleComputation = {
  readonly multiple: number | null;
  readonly exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' | 'MISSING_REQUIRED_FUNDAMENTALS' | null;
};

export function computePeerMultiple(peer: PeerCandidate, kind: ComparableMultipleKind): MultipleComputation {
  const f = peer.fundamentals;
  const m = peer.market;
  const price = m.price;
  const shares = f.sharesOutstanding;
  const marketCap = m.marketCap;
  const ev = m.enterpriseValue ?? marketCap;

  switch (kind) {
    case 'PE': {
      if (f.netIncome === undefined || f.netIncome <= 0) {
        return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      }
      return { multiple: marketCap / f.netIncome, exclusionReason: null };
    }
    case 'FORWARD_PE': {
      if (f.forwardEps === undefined || f.forwardEps <= 0 || shares <= 0) {
        return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      }
      if (price === undefined) {
        return { multiple: null, exclusionReason: 'MISSING_REQUIRED_FUNDAMENTALS' };
      }
      return { multiple: price / f.forwardEps, exclusionReason: null };
    }
    case 'PB': {
      if (f.bookEquity === undefined || f.bookEquity <= 0) {
        return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      }
      return { multiple: marketCap / f.bookEquity, exclusionReason: null };
    }
    case 'PS':
      if (f.revenue <= 0) return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      return { multiple: marketCap / f.revenue, exclusionReason: null };
    case 'EV_SALES':
      if (f.revenue <= 0) return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      return { multiple: ev / f.revenue, exclusionReason: null };
    case 'EV_EBITDA':
      if (f.ebitda === undefined || f.ebitda <= 0) {
        return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      }
      return { multiple: ev / f.ebitda, exclusionReason: null };
    case 'EV_EBIT':
      if (f.ebit === undefined || f.ebit <= 0) {
        return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      }
      return { multiple: ev / f.ebit, exclusionReason: null };
    case 'EV_FCF':
      if (f.fcf === undefined || f.fcf <= 0) {
        return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      }
      return { multiple: ev / f.fcf, exclusionReason: null };
    case 'FCF_YIELD':
      if (f.fcf === undefined || marketCap <= 0) {
        return { multiple: null, exclusionReason: 'MISSING_REQUIRED_FUNDAMENTALS' };
      }
      return { multiple: f.fcf / marketCap, exclusionReason: null };
    case 'PEG': {
      if (f.netIncome === undefined || f.netIncome <= 0 || f.revenueGrowth === undefined) {
        return { multiple: null, exclusionReason: 'MISSING_REQUIRED_FUNDAMENTALS' };
      }
      const pe = marketCap / f.netIncome;
      const growthPct = f.revenueGrowth * 100;
      if (growthPct <= 0) return { multiple: null, exclusionReason: 'NEGATIVE_OR_UNDEFINED_DENOMINATOR' };
      return { multiple: pe / growthPct, exclusionReason: null };
    }
    case 'EV_INVESTED_CAPITAL':
      if (f.investedCapital === undefined || f.investedCapital <= 0) {
        return { multiple: null, exclusionReason: 'MISSING_REQUIRED_FUNDAMENTALS' };
      }
      return { multiple: ev / f.investedCapital, exclusionReason: null };
    default:
      return { multiple: null, exclusionReason: 'MISSING_REQUIRED_FUNDAMENTALS' };
  }
}

export function impliedValuesFromMultiple(
  target: PeerCandidate,
  kind: ComparableMultipleKind,
  multiple: number,
): { readonly equityValue: number; readonly enterpriseValue: number | null } {
  const f = target.fundamentals;
  const netDebt = (target.market.enterpriseValue ?? target.market.marketCap) - target.market.marketCap;

  switch (kind) {
    case 'PE':
      return {
        equityValue: multiple * (f.netIncome ?? 0),
        enterpriseValue: multiple * (f.netIncome ?? 0) + netDebt,
      };
    case 'FORWARD_PE': {
      const forwardNet = (f.forwardEps ?? 0) * f.sharesOutstanding;
      return { equityValue: multiple * forwardNet, enterpriseValue: multiple * forwardNet + netDebt };
    }
    case 'PB':
      return {
        equityValue: multiple * (f.bookEquity ?? 0),
        enterpriseValue: multiple * (f.bookEquity ?? 0) + netDebt,
      };
    case 'PS':
      return { equityValue: multiple * f.revenue, enterpriseValue: multiple * f.revenue + netDebt };
    case 'EV_SALES':
    case 'EV_EBITDA':
    case 'EV_EBIT':
    case 'EV_FCF':
    case 'EV_INVESTED_CAPITAL': {
      const ev = applyEvMultiple(kind, multiple, f);
      return { equityValue: ev - netDebt, enterpriseValue: ev };
    }
    case 'FCF_YIELD': {
      const equity = f.fcf !== undefined && multiple > 0 ? f.fcf / multiple : 0;
      return { equityValue: equity, enterpriseValue: equity + netDebt };
    }
    case 'PEG': {
      const pe = multiple * (f.revenueGrowth ?? 0) * 100;
      return {
        equityValue: pe * (f.netIncome ?? 0),
        enterpriseValue: pe * (f.netIncome ?? 0) + netDebt,
      };
    }
    default:
      return { equityValue: 0, enterpriseValue: null };
  }
}

function applyEvMultiple(
  kind: ComparableMultipleKind,
  multiple: number,
  f: PeerCandidate['fundamentals'],
): number {
  switch (kind) {
    case 'EV_SALES':
      return multiple * f.revenue;
    case 'EV_EBITDA':
      return multiple * (f.ebitda ?? 0);
    case 'EV_EBIT':
      return multiple * (f.ebit ?? 0);
    case 'EV_FCF':
      return multiple * (f.fcf ?? 0);
    case 'EV_INVESTED_CAPITAL':
      return multiple * (f.investedCapital ?? 0);
    default:
      return 0;
  }
}
