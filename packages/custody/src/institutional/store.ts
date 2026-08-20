import type { NativeCustodyAssetId } from '../native-assets.ts';
import type { NativeDepositRecord } from './types.ts';
import type {
  ApprovalAction,
  CompromiseIncident,
  CustodyVault,
  CustodyWallet,
  InstitutionalDestination,
  NativeWithdrawal,
  RebalanceProposal,
  SecurityControlState,
} from './types.ts';
import type { InstitutionalSecurityControl } from './taxonomy.ts';
import type {
  CustodyWalletId,
  InstitutionalDestinationId,
  NativeWithdrawalId,
  VaultId,
} from './ids.ts';

export class InstitutionalCustodyStore {
  readonly vaults = new Map<VaultId, CustodyVault>();
  readonly wallets = new Map<CustodyWalletId, CustodyWallet>();
  readonly destinations = new Map<InstitutionalDestinationId, InstitutionalDestination>();
  readonly withdrawals = new Map<NativeWithdrawalId, NativeWithdrawal>();
  readonly deposits = new Map<string, NativeDepositRecord>();
  readonly approvals: ApprovalAction[] = [];
  readonly proposals: RebalanceProposal[] = [];
  readonly incidents: CompromiseIncident[] = [];
  readonly controls = new Map<InstitutionalSecurityControl, SecurityControlState>();
  readonly reservations = new Map<
    string,
    { vaultId: VaultId; quantity: bigint; assetId: NativeCustodyAssetId; released: boolean; debited: boolean }
  >();
  readonly attributed = new Map<string, bigint>();
  lastIndexedHeight = 0n;

  putVault(vault: CustodyVault): void {
    this.vaults.set(vault.vaultId, vault);
  }
  putWallet(wallet: CustodyWallet): void {
    this.wallets.set(wallet.walletId, wallet);
  }
  putDestination(destination: InstitutionalDestination): void {
    this.destinations.set(destination.destinationId, destination);
  }
  putWithdrawal(withdrawal: NativeWithdrawal): void {
    this.withdrawals.set(withdrawal.withdrawalId, withdrawal);
  }
  putDeposit(deposit: NativeDepositRecord): void {
    this.deposits.set(deposit.depositKey, deposit);
  }
}
