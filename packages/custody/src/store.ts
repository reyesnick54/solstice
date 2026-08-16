import type {
  CustodyAccountId,
  DepositId,
  DestinationId,
  TravelRuleMessageId,
  WithdrawalId,
} from './ids.ts';
import type {
  AssetWithdrawal,
  CustodyReconciliationReport,
  ExternalDeposit,
  KillSwitchKind,
  TravelRuleMessage,
  WithdrawalDestination,
} from './types.ts';

export class CustodyStore {
  readonly deposits = new Map<DepositId, ExternalDeposit>();
  readonly withdrawals = new Map<WithdrawalId, AssetWithdrawal>();
  readonly destinations = new Map<DestinationId, WithdrawalDestination>();
  readonly destinationsByCustomer = new Map<string, DestinationId[]>();
  readonly travelMessages = new Map<TravelRuleMessageId, TravelRuleMessage>();
  readonly notices = new Set<string>();
  readonly reconciliations: CustodyReconciliationReport[] = [];
  readonly killSwitches = new Map<KillSwitchKind, { active: boolean; reason: string }>();
  readonly addressOwners = new Map<string, { customerId: string; custodyAccountId: CustodyAccountId }>();

  putDeposit(deposit: ExternalDeposit): void {
    this.deposits.set(deposit.depositId, deposit);
  }
  putWithdrawal(withdrawal: AssetWithdrawal): void {
    this.withdrawals.set(withdrawal.withdrawalId, withdrawal);
  }
  putDestination(destination: WithdrawalDestination): void {
    this.destinations.set(destination.destinationId, destination);
    const list = this.destinationsByCustomer.get(destination.customerId) ?? [];
    list.push(destination.destinationId);
    this.destinationsByCustomer.set(destination.customerId, list);
  }
  putMessage(message: TravelRuleMessage): void {
    this.travelMessages.set(message.messageId, message);
  }
}
