/**
 * EXEC01 — broker securities settlement scope for custody reconciliation (simulation).
 */

import type { UtcInstant } from '@solstice/domain';

export type Exec01BrokerSettlementScope = {
  readonly scopeKind: 'BROKER_SECURITIES_SETTLEMENT';
  readonly brokerAccountId: string;
  readonly custodyAccountRef: string | null;
  readonly settlementId: string;
  readonly status: 'PENDING' | 'SETTLED' | 'FAILED';
  readonly expectedSettlementDate: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly simulation: true;
};

export function freezeExec01BrokerSettlementScope(scope: Exec01BrokerSettlementScope): Exec01BrokerSettlementScope {
  return Object.freeze({ ...scope });
}
