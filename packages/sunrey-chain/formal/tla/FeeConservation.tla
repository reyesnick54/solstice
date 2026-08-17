--------------------------- MODULE FeeConservation ---------------------------
EXTENDS Naturals

VARIABLES reservedTotal, outstanding, charged, released, burned, sink, rewards

Init ==
  reservedTotal = 0 /\ outstanding = 0 /\ charged = 0 /\ released = 0 /\ burned = 0 /\ sink = 0 /\ rewards = 0

Reserve == reservedTotal' = reservedTotal + 1 /\ outstanding' = outstanding + 1 /\ UNCHANGED <<charged, released, burned, sink, rewards>>
Charge == outstanding > 0 /\ outstanding' = outstanding - 1 /\ charged' = charged + 1 /\ burned' = burned + 1 /\ UNCHANGED <<reservedTotal, released, sink, rewards>>
Release == outstanding > 0 /\ outstanding' = outstanding - 1 /\ released' = released + 1 /\ UNCHANGED <<reservedTotal, charged, burned, sink, rewards>>

Next == Reserve \/ Charge \/ Release
ReservedIdentity == outstanding + charged + released = reservedTotal
FeeIdentity == charged = burned + sink + rewards
Spec == Init /\ [][Next]_<<reservedTotal, outstanding, charged, released, burned, sink, rewards>>
=============================================================================
