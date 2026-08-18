------------------------- MODULE WalletAuthorizationSafety -------------------------
EXTENDS Naturals

VARIABLES network, keyNetwork, sessionAuth, nativeAuthority, delegation, actor, approvalHash, txHash, authorized, finalizedRewritten

Init ==
  /\ network = "PRODUCTION"
  /\ keyNetwork = "PRODUCTION"
  /\ sessionAuth = "NONE"
  /\ nativeAuthority = "PRESENT"
  /\ delegation = "ACTIVE"
  /\ actor = "OWNER"
  /\ approvalHash = "tx1"
  /\ txHash = "tx1"
  /\ authorized = FALSE
  /\ finalizedRewritten = FALSE

Next ==
  \/ sessionAuth' = "LOGGED_IN" /\ UNCHANGED <<network, keyNetwork, nativeAuthority, delegation, actor, approvalHash, txHash, authorized, finalizedRewritten>>
  \/ delegation' = "REVOKED" /\ authorized' = FALSE /\ UNCHANGED <<network, keyNetwork, sessionAuth, nativeAuthority, actor, approvalHash, txHash, finalizedRewritten>>
  \/ actor' = "GUARDIAN" /\ authorized' = FALSE /\ UNCHANGED <<network, keyNetwork, sessionAuth, nativeAuthority, delegation, approvalHash, txHash, finalizedRewritten>>
  \/ actor' = "AI" /\ authorized' = FALSE /\ UNCHANGED <<network, keyNetwork, sessionAuth, nativeAuthority, delegation, approvalHash, txHash, finalizedRewritten>>
  \/ keyNetwork' = "TESTNET" /\ authorized' = FALSE /\ UNCHANGED <<network, sessionAuth, nativeAuthority, delegation, actor, approvalHash, txHash, finalizedRewritten>>
  \/ txHash' = "tx2" /\ authorized' = FALSE /\ UNCHANGED <<network, keyNetwork, sessionAuth, nativeAuthority, delegation, actor, approvalHash, finalizedRewritten>>

WrongNetworkCannotAuthorize == network # keyNetwork => authorized = FALSE
ChangedTransactionInvalidatesApproval == approvalHash # txHash => authorized = FALSE
RevokedDelegationCannotAuthorize == delegation = "REVOKED" => authorized = FALSE
GuardianCannotSpend == actor = "GUARDIAN" => authorized = FALSE
RecoveryCannotRewriteFinalized == finalizedRewritten = FALSE
LoginIsNotNativeSigning == sessionAuth = "LOGGED_IN" => (nativeAuthority = "PRESENT" \/ authorized = FALSE)
AiCannotConvertSessionToMaster == actor = "AI" => authorized = FALSE
Spec == Init /\ [][Next]_<<network, keyNetwork, sessionAuth, nativeAuthority, delegation, actor, approvalHash, txHash, authorized, finalizedRewritten>>
=============================================================================
