import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type WalletAuthorizationState = {
  readonly network: 'PRODUCTION' | 'TESTNET';
  readonly keyNetwork: 'PRODUCTION' | 'TESTNET';
  readonly sessionAuth: 'LOGGED_IN' | 'NONE';
  readonly nativeAuthority: 'PRESENT' | 'ABSENT';
  readonly delegation: 'ACTIVE' | 'REVOKED';
  readonly actor: 'OWNER' | 'GUARDIAN' | 'AI';
  readonly approvalHash: string;
  readonly txHash: string;
  readonly authorized: boolean;
  readonly finalizedRewritten: false;
};

export function createWalletAuthorizationModel(bounds: FormalModelBounds): FormalModel<WalletAuthorizationState> {
  const maxHeight = Math.max(bounds.maxHeight ?? 2, 2);
  return {
    modelId: 'WALLET_AUTHORIZATION_SAFETY',
    modelVersion: '1.0.0',
    bounds: { maxHeight, validators: 1 },
    init: () => ({
      network: 'PRODUCTION',
      keyNetwork: 'PRODUCTION',
      sessionAuth: 'NONE',
      nativeAuthority: 'PRESENT',
      delegation: 'ACTIVE',
      actor: 'OWNER',
      approvalHash: 'tx1',
      txHash: 'tx1',
      authorized: false,
      finalizedRewritten: false,
    }),
    next: (state) => {
      const out: Transition<WalletAuthorizationState>[] = [];
      out.push({ name: 'Login', next: { ...state, sessionAuth: 'LOGGED_IN' } });
      out.push({ name: 'Logout', next: { ...state, sessionAuth: 'NONE' } });
      out.push({ name: 'RevokeDelegation', next: { ...state, delegation: 'REVOKED', authorized: false } });
      out.push({ name: 'SelectGuardian', next: { ...state, actor: 'GUARDIAN', authorized: false } });
      out.push({ name: 'SelectAi', next: { ...state, actor: 'AI', authorized: false } });
      out.push({ name: 'TestnetKey', next: { ...state, keyNetwork: 'TESTNET', authorized: false } });
      out.push({ name: 'TamperTransaction', next: { ...state, txHash: 'tx2', authorized: false } });
      out.push({ name: 'RefuseWrongNetwork', next: null });
      out.push({ name: 'RefuseRevokedDelegation', next: null });
      out.push({ name: 'RefuseGuardianSpend', next: null });
      out.push({ name: 'RefuseRecoveryRewrite', next: null });
      out.push({ name: 'RefuseLoginAsSign', next: null });
      out.push({ name: 'RefuseAiMasterAuthority', next: null });
      if (
        state.network === state.keyNetwork &&
        state.nativeAuthority === 'PRESENT' &&
        state.delegation === 'ACTIVE' &&
        state.actor === 'OWNER' &&
        state.approvalHash === state.txHash
      ) {
        out.push({ name: 'AuthorizeNative', next: { ...state, authorized: true } });
      } else {
        out.push({ name: 'RefuseAuthorize', next: null });
      }
      return out;
    },
    key: (state) =>
      `${state.network}|${state.keyNetwork}|${state.sessionAuth}|${state.delegation}|${state.actor}|${state.txHash}|${state.authorized}`,
    invariants: {
      WRONG_NETWORK_CANNOT_AUTHORIZE: (state) => state.network === state.keyNetwork || state.authorized === false,
      CHANGED_TRANSACTION_INVALIDATES_APPROVAL: (state) =>
        state.approvalHash === state.txHash || state.authorized === false,
      REVOKED_DELEGATION_CANNOT_AUTHORIZE: (state) => state.delegation === 'ACTIVE' || state.authorized === false,
      GUARDIAN_CANNOT_SPEND: (state) => state.actor !== 'GUARDIAN' || state.authorized === false,
      RECOVERY_CANNOT_REWRITE_FINALIZED: (state) => state.finalizedRewritten === false,
      LOGIN_IS_NOT_NATIVE_SIGNING: (state) =>
        state.sessionAuth !== 'LOGGED_IN' || state.nativeAuthority === 'PRESENT' || state.authorized === false,
      AI_CANNOT_CONVERT_SESSION_TO_MASTER: (state) => state.actor !== 'AI' || state.authorized === false,
    },
  };
}
