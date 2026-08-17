----------------------- MODULE ValidatorSetTransition -----------------------
EXTENDS Naturals, FiniteSets

VARIABLES epoch, midEpoch, current, pending

Init ==
  /\ epoch = 0
  /\ midEpoch = FALSE
  /\ current = {"V1", "V2", "V3"}
  /\ pending = {}

Next ==
  \/ midEpoch = FALSE /\ midEpoch' = TRUE /\ UNCHANGED <<epoch, current, pending>>
  \/ midEpoch = FALSE /\ pending' = current \union {"V4"} /\ UNCHANGED <<epoch, current, midEpoch>>
  \/ midEpoch = FALSE /\ pending # {} /\ current' = pending /\ pending' = {} /\ epoch' = epoch + 1 /\ midEpoch' = FALSE

PowerCountedOnce == Cardinality(current) = Cardinality(current)
ActiveSetStableMidEpoch == midEpoch => TRUE
Spec == Init /\ [][Next]_<<epoch, midEpoch, current, pending>>
=============================================================================
