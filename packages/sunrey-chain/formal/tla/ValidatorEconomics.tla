--------------------------- MODULE ValidatorEconomics ---------------------------
EXTENDS Naturals

CONSTANTS Issued, Customer, Delay

VARIABLES epoch, bonded, pending, available, penalized, unbondEpoch,
          rewarded, penaltyApplied, customer, policyVersion, pool, paid, remainder

Init ==
  /\ epoch = 0
  /\ bonded = 0
  /\ pending = 0
  /\ available = Issued
  /\ penalized = 0
  /\ unbondEpoch = -1
  /\ rewarded = FALSE
  /\ penaltyApplied = FALSE
  /\ customer = Customer
  /\ policyVersion = 1
  /\ pool = 0
  /\ paid = 0
  /\ remainder = 0

Bond ==
  /\ bonded = 0 /\ pending = 0 /\ available > 0
  /\ bonded' = 1
  /\ available' = available - 1
  /\ UNCHANGED <<epoch, pending, penalized, unbondEpoch, rewarded, penaltyApplied, customer, policyVersion, pool, paid, remainder>>

RequestUnbond ==
  /\ bonded > 0 /\ pending = 0
  /\ pending' = bonded
  /\ bonded' = 0
  /\ unbondEpoch' = epoch
  /\ UNCHANGED <<epoch, available, penalized, rewarded, penaltyApplied, customer, policyVersion, pool, paid, remainder>>

AdvanceEpoch ==
  /\ epoch' = epoch + 1
  /\ UNCHANGED <<bonded, pending, available, penalized, unbondEpoch, rewarded, penaltyApplied, customer, policyVersion, pool, paid, remainder>>

ReleaseUnbond ==
  /\ pending > 0 /\ unbondEpoch >= 0 /\ epoch >= unbondEpoch + Delay
  /\ available' = available + pending
  /\ pending' = 0
  /\ unbondEpoch' = -1
  /\ UNCHANGED <<epoch, bonded, penalized, rewarded, penaltyApplied, customer, policyVersion, pool, paid, remainder>>

CreditPool ==
  /\ pool' = pool + 1
  /\ UNCHANGED <<epoch, bonded, pending, available, penalized, unbondEpoch, rewarded, penaltyApplied, customer, policyVersion, paid, remainder>>

Reward ==
  /\ rewarded = FALSE /\ pool > 0
  /\ rewarded' = TRUE
  /\ paid' = pool
  /\ pool' = 0
  /\ remainder' = 0
  /\ UNCHANGED <<epoch, bonded, pending, available, penalized, unbondEpoch, penaltyApplied, customer, policyVersion>>

Penalty ==
  /\ penaltyApplied = FALSE /\ bonded + pending > 0
  /\ penaltyApplied' = TRUE
  /\ penalized' = penalized + 1
  /\ bonded' = IF bonded > 0 THEN bonded - 1 ELSE bonded
  /\ pending' = IF bonded = 0 /\ pending > 0 THEN pending - 1 ELSE pending
  /\ UNCHANGED <<epoch, available, unbondEpoch, rewarded, customer, policyVersion, pool, paid, remainder>>

Next == Bond \/ RequestUnbond \/ AdvanceEpoch \/ ReleaseUnbond \/ CreditPool \/ Reward \/ Penalty

BondConservation == bonded + pending + available + penalized = Issued
NoDuplicateReward == paid <= Issued
NoDuplicatePenalty == penalized <= 1
CustomerUnaffected == customer = Customer
PolicyVersionDeterministic == policyVersion = 1

Spec == Init /\ [][Next]_<<epoch, bonded, pending, available, penalized, unbondEpoch, rewarded, penaltyApplied, customer, policyVersion, pool, paid, remainder>>
=============================================================================
