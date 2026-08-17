---------------------------- MODULE SignerSafety ----------------------------
EXTENDS Naturals

VARIABLES lastHeight, lastRound, lastStep, lastValue, role

Init ==
  /\ lastHeight = 0
  /\ lastRound = 0
  /\ lastStep = 1
  /\ lastValue = "GENESIS"
  /\ role = "ACTIVE"

Sign(h, r, s, val) ==
  /\ role = "ACTIVE"
  /\ \/ h > lastHeight
     \/ h = lastHeight /\ r > lastRound
     \/ h = lastHeight /\ r = lastRound /\ s > lastStep
     \/ h = lastHeight /\ r = lastRound /\ s = lastStep /\ val = lastValue
  /\ lastHeight' = h
  /\ lastRound' = r
  /\ lastStep' = s
  /\ lastValue' = val
  /\ UNCHANGED role

Next ==
  \/ \E h \in 1..2, r \in 0..1, s \in 1..3, val \in {"A", "B"} : Sign(h, r, s, val)
  \/ role' = "PASSIVE" /\ UNCHANGED <<lastHeight, lastRound, lastStep, lastValue>>

OneCoordinateOneValue == lastValue # ""
Spec == Init /\ [][Next]_<<lastHeight, lastRound, lastStep, lastValue, role>>
=============================================================================
