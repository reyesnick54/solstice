-------------------------- MODULE ExchangeAtomicDvp --------------------------
EXTENDS Naturals

VARIABLES reservedBase, reservedQuote, settled, cancelled, authorized

Init == reservedBase = 2 /\ reservedQuote = 2 /\ settled = FALSE /\ cancelled = FALSE /\ authorized = TRUE

Settle ==
  /\ authorized /\ ~settled /\ ~cancelled
  /\ reservedBase' = 0 /\ reservedQuote' = 0
  /\ settled' = TRUE /\ authorized' = FALSE /\ UNCHANGED cancelled

Cancel ==
  /\ authorized /\ ~settled /\ ~cancelled
  /\ reservedBase' = 0 /\ reservedQuote' = 0
  /\ cancelled' = TRUE /\ authorized' = FALSE /\ UNCHANGED settled

Next == Settle \/ Cancel
Atomic == settled => (reservedBase = 0 /\ reservedQuote = 0)
NoDouble == ~(settled /\ cancelled)
Spec == Init /\ [][Next]_<<reservedBase, reservedQuote, settled, cancelled, authorized>>
=============================================================================
