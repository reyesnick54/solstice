------------------------- MODULE GovernanceOperationSafety -------------------------
EXTENDS Naturals

VARIABLES status, approvals, height, activationHeight, actor, packageHash, emergencyMint, restriction

Init ==
  /\ status = "PACKAGED"
  /\ approvals = 0
  /\ height = 0
  /\ activationHeight = 2
  /\ actor = "HUMAN"
  /\ packageHash = "pkg_v1"
  /\ emergencyMint = FALSE
  /\ restriction = "INACTIVE"

Next ==
  \/ status = "PACKAGED" /\ approvals' = approvals + 1 /\ UNCHANGED <<status, height, activationHeight, actor, packageHash, emergencyMint, restriction>>
  \/ status = "PACKAGED" /\ approvals >= 2 /\ status' = "APPROVED" /\ UNCHANGED <<approvals, height, activationHeight, actor, packageHash, emergencyMint, restriction>>
  \/ status = "APPROVED" /\ status' = "SCHEDULED" /\ UNCHANGED <<approvals, height, activationHeight, actor, packageHash, emergencyMint, restriction>>
  \/ status = "SCHEDULED" /\ actor = "HUMAN" /\ height >= activationHeight /\ packageHash = "pkg_v1" /\ status' = "ACTIVATED" /\ UNCHANGED <<approvals, height, activationHeight, actor, packageHash, emergencyMint, restriction>>
  \/ height' = height + 1 /\ UNCHANGED <<status, approvals, activationHeight, actor, packageHash, emergencyMint, restriction>>
  \/ restriction' = "ACTIVE" /\ emergencyMint' = FALSE /\ UNCHANGED <<status, approvals, height, activationHeight, actor, packageHash>>

WrongHashCannotActivate == status = "ACTIVATED" => packageHash = "pkg_v1"
InsufficientApprovalCannotActivate == status = "ACTIVATED" => approvals >= 2
ActivationNotBeforeCoordinate == status = "ACTIVATED" => height >= activationHeight
AiCannotAuthorize == status = "ACTIVATED" => actor = "HUMAN"
EmergencyCannotMint == emergencyMint = FALSE
RestrictionBounded == restriction = "ACTIVE" => emergencyMint = FALSE
Spec == Init /\ [][Next]_<<status, approvals, height, activationHeight, actor, packageHash, emergencyMint, restriction>>
=============================================================================
