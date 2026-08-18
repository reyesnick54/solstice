--------------------------- MODULE ProtocolTreasury ---------------------------
EXTENDS Naturals

CONSTANTS MaxQty

VARIABLES supply, available, reserved, authorized, disbursed, customer, governance

Init ==
  supply = MaxQty /\ available = MaxQty /\ reserved = 0 /\ authorized = MaxQty /\
    disbursed = 0 /\ customer = MaxQty /\ governance = 1

Reserve ==
  governance = 1 /\ authorized > reserved + disbursed /\ available > 0 /\
    available' = available - 1 /\ reserved' = reserved + 1 /\
    UNCHANGED <<supply, authorized, disbursed, customer, governance>>

Finalize ==
  governance = 1 /\ reserved > 0 /\ reserved' = reserved - 1 /\ disbursed' = disbursed + 1 /\
    UNCHANGED <<supply, available, authorized, customer, governance>>

CancelReservation ==
  reserved > 0 /\ reserved' = reserved - 1 /\ available' = available + 1 /\
    UNCHANGED <<supply, authorized, disbursed, customer, governance>>

Next == Reserve \/ Finalize \/ CancelReservation

TreasuryCannotCreateSupply == available + reserved + disbursed = supply /\ supply = MaxQty
ReservedNotDoubleSpent == reserved >= 0 /\ available >= 0
FinalizedLeqAuthorized == disbursed <= authorized
CancelReleases == available + reserved + disbursed = supply
CustomerUnaffected == customer = MaxQty
UnauthorizedCannotSpend == governance = 1

Spec == Init /\ [][Next]_<<supply, available, reserved, authorized, disbursed, customer, governance>>
=============================================================================
