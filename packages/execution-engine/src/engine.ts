import type { ExecutionAuthority } from '../../platform/src/authority/ExecutionAuthority.ts';
import { Money } from '../../contracts/src/money.ts';
import type { UtcInstant } from '../../contracts/src/time.ts';
import type { AdmissibleVerdict, RiskRefuse, RiskVerdict } from '../../contracts/src/risk-types.ts';
import type { StrategyProposal } from '../../contracts/src/strategy-types.ts';
import { SHARE_MICROS } from '../../contracts/src/investment-types.ts';
import type { RiskEngine } from '../../risk-engine/src/engine.ts';
import { PaperLedger, type PaperJournal } from './ledger/PaperLedger.ts';
import { LIVE_TRADING_ENABLED } from '../../flags/src/capabilities.ts';

export type ExecutionMode = 'SHADOW' | 'PAPER';

export type ShadowRecord = {
  readonly mode: 'SHADOW';
  readonly proposalId: string;
  readonly filled: false;
  readonly paperJournal: null;
};

export type PaperFill = {
  readonly mode: 'PAPER';
  readonly proposalId: string;
  readonly filledQuantityMicros: bigint;
  readonly fillPriceMinorUnits: bigint;
  readonly slippageBps: bigint;
  readonly partial: boolean;
  readonly paperJournal: PaperJournal;
  readonly eventVersion: 1;
};

export type ExecutionRefusal = {
  readonly ok: false;
  readonly code:
    | 'RISK_REFUSAL_IS_FINAL'
    | 'KILL_SWITCH'
    | 'MISSING_AUTHORITY'
    | 'LIVE_TRADING_DISABLED'
    | 'NO_ADMISSION';
  readonly reason: string;
};

export type ExecutionResult =
  | { readonly ok: true; readonly record: ShadowRecord | PaperFill }
  | ExecutionRefusal;

/**
 * Execution engine. Accepts only a valid ExecutionAuthority.
 * Shadow: record the proposal, no paper fill.
 * Paper: simulated fill with integer slippage and optional partial fill,
 * posted only to the paper ledger.
 *
 * A Risk Engine REFUSE cannot be passed here as AdmissibleVerdict.
 */
export class ExecutionEngine {
  readonly paper = new PaperLedger();
  readonly shadows: ShadowRecord[] = [];
  readonly #risk: RiskEngine;
  readonly slippageBps: bigint;
  readonly partialFillNumerator: bigint;
  readonly partialFillDenominator: bigint;

  constructor(
    risk: RiskEngine,
    options: {
      readonly slippageBps?: bigint;
      readonly partialFillNumerator?: bigint;
      readonly partialFillDenominator?: bigint;
    } = {},
  ) {
    this.#risk = risk;
    this.slippageBps = options.slippageBps ?? 15n;
    this.partialFillNumerator = options.partialFillNumerator ?? 1n;
    this.partialFillDenominator = options.partialFillDenominator ?? 2n;
  }

  execute(
    proposal: StrategyProposal,
    verdict: RiskVerdict,
    mode: ExecutionMode,
    executionAuthority: ExecutionAuthority,
    now: UtcInstant,
  ): ExecutionResult {
    if (LIVE_TRADING_ENABLED !== false) {
      return {
        ok: false,
        code: 'LIVE_TRADING_DISABLED',
        reason: 'LIVE_TRADING_ENABLED must remain false; no broker is contacted',
      };
    }
    if (
      !executionAuthority ||
      typeof executionAuthority.signature !== 'string' ||
      executionAuthority.signature.length === 0
    ) {
      return { ok: false, code: 'MISSING_AUTHORITY', reason: 'ExecutionAuthority is required' };
    }
    if (this.#risk.killSwitches.strategyHalted(proposal.strategyId)) {
      return { ok: false, code: 'KILL_SWITCH', reason: 'kill switch halted trading' };
    }
    if (verdict.kind === 'REFUSE') {
      return this.refuseFinal(verdict);
    }
    return this.admitAndRun(proposal, verdict, mode, executionAuthority, now);
  }

  /**
   * Typed admission. RiskRefuse is not assignable to AdmissibleVerdict.
   */
  executeAdmitted(
    proposal: StrategyProposal,
    admission: AdmissibleVerdict,
    mode: ExecutionMode,
    executionAuthority: ExecutionAuthority,
    now: UtcInstant,
  ): ExecutionResult {
    return this.execute(proposal, admission, mode, executionAuthority, now);
  }

  private refuseFinal(verdict: RiskRefuse): ExecutionRefusal {
    return {
      ok: false,
      code: 'RISK_REFUSAL_IS_FINAL',
      reason: verdict.reason,
    };
  }

  private admitAndRun(
    proposal: StrategyProposal,
    admission: AdmissibleVerdict,
    mode: ExecutionMode,
    executionAuthority: ExecutionAuthority,
    now: UtcInstant,
  ): ExecutionResult {
    const qty =
      admission.kind === 'REDUCE' ? admission.scaledQuantityMicros : proposal.quantityMicros;
    if (mode === 'SHADOW') {
      const record: ShadowRecord = Object.freeze({
        mode: 'SHADOW',
        proposalId: proposal.proposalId,
        filled: false,
        paperJournal: null,
      });
      this.shadows.push(record);
      return { ok: true, record };
    }
    const fillQty = (qty * this.partialFillNumerator) / this.partialFillDenominator;
    const filledQty = fillQty === 0n ? qty : fillQty;
    const slip =
      proposal.side === 'BUY'
        ? proposal.limitPriceMinorUnits +
          (proposal.limitPriceMinorUnits * this.slippageBps) / 10_000n
        : proposal.limitPriceMinorUnits -
          (proposal.limitPriceMinorUnits * this.slippageBps) / 10_000n;
    const fillPrice = slip < 1n ? 1n : slip;
    const notional = Money.fromMinorUnits(
      (filledQty * fillPrice) / SHARE_MICROS,
      proposal.currency,
    );
    const paperJournal = this.paper.postJournal(
      {
        actionType: 'PAPER_FILL',
        paperCashAccountId: `paper.cash.${proposal.strategyId}`,
        paperSecuritiesAccountId: `paper.sec.${proposal.strategyId}.${proposal.instrumentId}`,
        amount: notional,
        side: proposal.side,
        memo: `PAPER fill ${proposal.strategyId} ${proposal.instrumentId} — not a customer journal`,
        postedAt: now,
      },
      executionAuthority,
    );
    const record: PaperFill = Object.freeze({
      mode: 'PAPER',
      proposalId: proposal.proposalId,
      filledQuantityMicros: filledQty,
      fillPriceMinorUnits: fillPrice,
      slippageBps: this.slippageBps,
      partial: filledQty !== qty,
      paperJournal,
      eventVersion: 1 as const,
    });
    return { ok: true, record };
  }
}
