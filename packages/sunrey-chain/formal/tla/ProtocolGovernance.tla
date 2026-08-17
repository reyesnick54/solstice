------------------------- MODULE ProtocolGovernance -------------------------
EXTENDS Naturals

VARIABLES status, votes, height, activationHeight, rulesVersion, actor, binaryInstalled

Init ==
  /\ status = "DRAFT"
  /\ votes = 0
  /\ height = 0
  /\ activationHeight = 2
  /\ rulesVersion = 1
  /\ actor = "HUMAN"
  /\ binaryInstalled = FALSE

Next ==
  \/ status = "DRAFT" /\ status' = "PROPOSED" /\ UNCHANGED <<votes, height, activationHeight, rulesVersion, actor, binaryInstalled>>
  \/ status = "PROPOSED" /\ votes' = votes + 1 /\ UNCHANGED <<status, height, activationHeight, rulesVersion, actor, binaryInstalled>>
  \/ status = "PROPOSED" /\ votes >= 3 /\ status' = "AUTHORIZED" /\ UNCHANGED <<votes, height, activationHeight, rulesVersion, actor, binaryInstalled>>
  \/ status = "AUTHORIZED" /\ status' = "SCHEDULED" /\ UNCHANGED <<votes, height, activationHeight, rulesVersion, actor, binaryInstalled>>
  \/ status = "SCHEDULED" /\ actor = "HUMAN" /\ height >= activationHeight /\ status' = "ACTIVATED" /\ rulesVersion' = rulesVersion + 1 /\ UNCHANGED <<votes, height, activationHeight, actor, binaryInstalled>>
  \/ height' = height + 1 /\ UNCHANGED <<status, votes, activationHeight, rulesVersion, actor, binaryInstalled>>
  \/ binaryInstalled' = TRUE /\ UNCHANGED <<status, votes, height, activationHeight, rulesVersion, actor>>

ActivationNotBeforeHeight == status = "ACTIVATED" => height >= activationHeight
AiCannotActivate == status = "ACTIVATED" => actor = "HUMAN"
BinaryInstallDoesNotChangeRules == binaryInstalled => (status = "ACTIVATED" \/ rulesVersion = 1)
Spec == Init /\ [][Next]_<<status, votes, height, activationHeight, rulesVersion, actor, binaryInstalled>>
=============================================================================
