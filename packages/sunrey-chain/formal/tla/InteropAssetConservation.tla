---------------------- MODULE InteropAssetConservation ----------------------
EXTENDS Naturals

VARIABLES circulating, escrowed, remote, total
AssetId == "DEV_INTEROP_TEST_ASSET"

Init == circulating = 3 /\ escrowed = 0 /\ remote = 0 /\ total = 3
Escrow == circulating > 0 /\ circulating' = circulating - 1 /\ escrowed' = escrowed + 1 /\ UNCHANGED <<remote, total>>
Remote == escrowed > 0 /\ escrowed' = escrowed - 1 /\ remote' = remote + 1 /\ UNCHANGED <<circulating, total>>
Redeem == remote > 0 /\ remote' = remote - 1 /\ circulating' = circulating + 1 /\ UNCHANGED <<escrowed, total>>

Next == Escrow \/ Remote \/ Redeem
Boundary == circulating + escrowed + remote = total
Spec == Init /\ [][Next]_<<circulating, escrowed, remote, total>>
=============================================================================
