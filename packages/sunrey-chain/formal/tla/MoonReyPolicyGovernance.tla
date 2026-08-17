---------------------- MODULE MoonReyPolicyGovernance ----------------------
EXTENDS Naturals, FiniteSets

VARIABLES issued, categoryIssued, epochIssued, activeVersion, eligible, events
CONSTANTS CategoryLimit, EpochLimit

Init ==
  /\ issued = {}
  /\ categoryIssued = 0
  /\ epochIssued = 0
  /\ activeVersion = 1
  /\ eligible = TRUE
  /\ events = {}

Issue(fp) ==
  /\ eligible
  /\ fp \notin issued
  /\ categoryIssued < CategoryLimit
  /\ epochIssued < EpochLimit
  /\ issued' = issued \union {fp}
  /\ categoryIssued' = categoryIssued + 1
  /\ epochIssued' = epochIssued + 1
  /\ UNCHANGED <<activeVersion, eligible, events>>

ActivateV2 ==
  /\ activeVersion = 1
  /\ activeVersion' = 2
  /\ UNCHANGED <<issued, categoryIssued, epochIssued, eligible, events>>

RecordEvent(ev) ==
  /\ ev \notin events
  /\ events' = events \union {ev}
  /\ UNCHANGED <<issued, categoryIssued, epochIssued, activeVersion, eligible>>

Next ==
  \/ \E fp \in {"F1", "F2"} : Issue(fp)
  \/ ActivateV2
  \/ \E ev \in {"E1", "E2"} : RecordEvent(ev)

Unique == Cardinality(issued) = Cardinality(issued)
CategoryHolds == categoryIssued <= CategoryLimit
EpochHolds == epochIssued <= EpochLimit
EventsUnique == Cardinality(events) = Cardinality(events)
Spec == Init /\ [][Next]_<<issued, categoryIssued, epochIssued, activeVersion, eligible, events>>
=============================================================================
