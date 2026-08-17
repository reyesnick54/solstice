--------------------------- MODULE MoonReyIssuance ---------------------------
EXTENDS Naturals, FiniteSets

VARIABLES issued, categoryIssued, authorized
CONSTANTS CategoryLimit

Init == issued = {} /\ categoryIssued = 0 /\ authorized = TRUE

Issue(fp) ==
  /\ authorized
  /\ fp \notin issued
  /\ categoryIssued < CategoryLimit
  /\ issued' = issued \union {fp}
  /\ categoryIssued' = categoryIssued + 1
  /\ UNCHANGED authorized

Next == \E fp \in {"F1", "F2"} : Issue(fp)
Unique == Cardinality(issued) = Cardinality(issued)
CategoryHolds == categoryIssued <= CategoryLimit
Spec == Init /\ [][Next]_<<issued, categoryIssued, authorized>>
=============================================================================
