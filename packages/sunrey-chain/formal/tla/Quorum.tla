------------------------------ MODULE Quorum ------------------------------
EXTENDS Naturals

\* SunRey weighted quorum arithmetic.
\* Matches rust/crates/consensus/src/quorum.rs and validators/src/power.rs:
\*   ExceedsTwoThirds(p, n) <=> p > (2 * n) \div 3
\*   HasTwoThirdsPlus(p, n) <=> 3 * p > 2 * n
\* Equality is not a quorum.

FloorTwoThirds(n) == (2 * n) \div 3
TwoThirdsThreshold(n) == FloorTwoThirds(n) + 1
ExceedsTwoThirds(p, n) == n > 0 /\ p > FloorTwoThirds(n)
HasTwoThirdsPlus(p, n) == 3 * p > 2 * n
ExceedsOneThird(p, n) == n > 0 /\ p > (n \div 3)
MaxByzantine(n) == IF n = 0 THEN 0 ELSE (n - 1) \div 3

=============================================================================
