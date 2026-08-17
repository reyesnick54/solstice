------------------------ MODULE CryptoPolicyMigration ------------------------
EXTENDS Naturals

States == {"CLASSICAL_ONLY", "HYBRID_AVAILABLE", "HYBRID_REQUIRED_SELECTED_ROLES", "PQ_PRIMARY", "LEGACY_VERIFY_ONLY"}
VARIABLES chainPolicy, governed, historicalVerify

Init == chainPolicy = "CLASSICAL_ONLY" /\ governed = FALSE /\ historicalVerify = TRUE

Advance(s) ==
  /\ governed' = TRUE
  /\ chainPolicy' = s
  /\ UNCHANGED historicalVerify

Next ==
  \/ chainPolicy = "CLASSICAL_ONLY" /\ Advance("HYBRID_AVAILABLE")
  \/ chainPolicy = "HYBRID_AVAILABLE" /\ Advance("HYBRID_REQUIRED_SELECTED_ROLES")
  \/ chainPolicy = "HYBRID_REQUIRED_SELECTED_ROLES" /\ Advance("PQ_PRIMARY")
  \/ chainPolicy = "PQ_PRIMARY" /\ Advance("LEGACY_VERIFY_ONLY")

GovernedOnly == chainPolicy = "CLASSICAL_ONLY" \/ governed
HistoricalRetained == historicalVerify = TRUE
Spec == Init /\ [][Next]_<<chainPolicy, governed, historicalVerify>>
=============================================================================
