---------------------- MODULE NativeAssetConservation ----------------------
EXTENDS Naturals

VARIABLES issued, burned, circulating, locked

Init == issued = 0 /\ burned = 0 /\ circulating = 0 /\ locked = 0

Issue == issued' = issued + 1 /\ circulating' = circulating + 1 /\ UNCHANGED <<burned, locked>>
Lock == circulating > 0 /\ circulating' = circulating - 1 /\ locked' = locked + 1 /\ UNCHANGED <<issued, burned>>
Unlock == locked > 0 /\ locked' = locked - 1 /\ circulating' = circulating + 1 /\ UNCHANGED <<issued, burned>>
Burn == circulating > 0 /\ circulating' = circulating - 1 /\ burned' = burned + 1 /\ UNCHANGED <<issued, locked>>
Transfer == UNCHANGED <<issued, burned, circulating, locked>>

Next == Issue \/ Lock \/ Unlock \/ Burn \/ Transfer
SupplyIdentity == issued - burned = circulating + locked
NoNegative == circulating >= 0 /\ locked >= 0
Spec == Init /\ [][Next]_<<issued, burned, circulating, locked>>
=============================================================================
