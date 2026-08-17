---------------------- MODULE GenesisAllocationConservation ----------------------
EXTENDS Naturals

VARIABLES declaredS, allocatedS, declaredM, allocatedM

Init == declaredS = 0 /\ allocatedS = 0 /\ declaredM = 0 /\ allocatedM = 0

AllocS == allocatedS' = allocatedS + 1 /\ declaredS' = declaredS + 1 /\ UNCHANGED <<declaredM, allocatedM>>
AllocM == allocatedM' = allocatedM + 1 /\ declaredM' = declaredM + 1 /\ UNCHANGED <<declaredS, allocatedS>>

Next == AllocS \/ AllocM
GenesisTotalsExact == declaredS = allocatedS /\ declaredM = allocatedM
Spec == Init /\ [][Next]_<<declaredS, allocatedS, declaredM, allocatedM>>
=============================================================================
