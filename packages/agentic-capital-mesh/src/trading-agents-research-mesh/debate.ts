import type { InvestDebateState, RiskDebateState } from './types.ts';

export function initialInvestDebateState(): InvestDebateState {
  return Object.freeze({
    bullHistory: '',
    bearHistory: '',
    history: '',
    currentResponse: '',
    count: 0,
  });
}

export function initialRiskDebateState(): RiskDebateState {
  return Object.freeze({
    aggressiveHistory: '',
    conservativeHistory: '',
    neutralHistory: '',
    history: '',
    latestSpeaker: '',
    currentAggressiveResponse: '',
    currentConservativeResponse: '',
    currentNeutralResponse: '',
    count: 0,
  });
}

export function appendInvestDebateTurn(
  state: InvestDebateState,
  speaker: 'BULL_RESEARCHER' | 'BEAR_RESEARCHER',
  response: string,
): InvestDebateState {
  const prefix = speaker === 'BULL_RESEARCHER' ? 'Bull' : 'Bear';
  const line = `${prefix}: ${response}`;
  return Object.freeze({
    bullHistory: speaker === 'BULL_RESEARCHER' ? `${state.bullHistory}\n${line}`.trim() : state.bullHistory,
    bearHistory: speaker === 'BEAR_RESEARCHER' ? `${state.bearHistory}\n${line}`.trim() : state.bearHistory,
    history: `${state.history}\n${line}`.trim(),
    currentResponse: `${prefix}: ${response.slice(0, 120)}`,
    count: state.count + 1,
  });
}

export function appendRiskDebateTurn(
  state: RiskDebateState,
  speaker: 'AGGRESSIVE_RISK_ANALYST' | 'CONSERVATIVE_RISK_ANALYST' | 'NEUTRAL_RISK_ANALYST',
  response: string,
): RiskDebateState {
  const label =
    speaker === 'AGGRESSIVE_RISK_ANALYST'
      ? 'Aggressive'
      : speaker === 'CONSERVATIVE_RISK_ANALYST'
        ? 'Conservative'
        : 'Neutral';
  const line = `${label}: ${response}`;
  return Object.freeze({
    aggressiveHistory:
      speaker === 'AGGRESSIVE_RISK_ANALYST' ? `${state.aggressiveHistory}\n${line}`.trim() : state.aggressiveHistory,
    conservativeHistory:
      speaker === 'CONSERVATIVE_RISK_ANALYST'
        ? `${state.conservativeHistory}\n${line}`.trim()
        : state.conservativeHistory,
    neutralHistory:
      speaker === 'NEUTRAL_RISK_ANALYST' ? `${state.neutralHistory}\n${line}`.trim() : state.neutralHistory,
    history: `${state.history}\n${line}`.trim(),
    latestSpeaker: label,
    currentAggressiveResponse:
      speaker === 'AGGRESSIVE_RISK_ANALYST' ? response : state.currentAggressiveResponse,
    currentConservativeResponse:
      speaker === 'CONSERVATIVE_RISK_ANALYST' ? response : state.currentConservativeResponse,
    currentNeutralResponse: speaker === 'NEUTRAL_RISK_ANALYST' ? response : state.currentNeutralResponse,
    count: state.count + 1,
  });
}
