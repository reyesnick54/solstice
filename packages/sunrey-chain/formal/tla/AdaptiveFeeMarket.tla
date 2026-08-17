--------------------------- MODULE AdaptiveFeeMarket ---------------------------
EXTENDS Naturals

CONSTANTS MinPrice, MaxPrice, Target, Denom, MaxAdj

VARIABLES price, usage, reserved, outstanding, charged, released, validator, burned, treasury, policyVersion

Init ==
  price = 2 /\ usage = Target /\ reserved = 0 /\ outstanding = 0 /\ charged = 0 /\
  released = 0 /\ validator = 0 /\ burned = 0 /\ treasury = 0 /\ policyVersion = 2

NextPrice(p, u) ==
  IF u >= Target
  THEN LET raw == (p * (u - Target)) \div (Target * Denom)
           adj == IF raw > MaxAdj THEN MaxAdj ELSE raw
       IN IF p + adj > MaxPrice THEN MaxPrice ELSE p + adj
  ELSE LET raw == (p * (Target - u)) \div (Target * Denom)
           adj == IF raw > MaxAdj THEN MaxAdj ELSE raw
       IN IF p < adj THEN MinPrice ELSE IF p - adj < MinPrice THEN MinPrice ELSE p - adj

UpdatePrice(u) == price' = NextPrice(price, u) /\ usage' = u /\
  UNCHANGED <<reserved, outstanding, charged, released, validator, burned, treasury, policyVersion>>

Reserve == reserved' = reserved + 1 /\ outstanding' = outstanding + 1 /\
  UNCHANGED <<price, usage, charged, released, validator, burned, treasury, policyVersion>>

Charge == outstanding > 0 /\ outstanding' = outstanding - 1 /\ charged' = charged + 1 /\
  validator' = validator + 1 /\ UNCHANGED <<price, usage, reserved, released, burned, treasury, policyVersion>>

Release == outstanding > 0 /\ outstanding' = outstanding - 1 /\ released' = released + 1 /\
  UNCHANGED <<price, usage, reserved, charged, validator, burned, treasury, policyVersion>>

Next == UpdatePrice(0) \/ UpdatePrice(Target) \/ Reserve \/ Charge \/ Release

PriceWithinBounds == price >= MinPrice /\ price <= MaxPrice
ReservedIdentity == outstanding + charged + released = reserved
DispositionConservation == charged = validator + burned + treasury
MaxFeeAuthorization == charged <= reserved
PolicyVersionDeterministic == policyVersion = 2

Spec == Init /\ [][Next]_<<price, usage, reserved, outstanding, charged, released, validator, burned, treasury, policyVersion>>
=============================================================================
