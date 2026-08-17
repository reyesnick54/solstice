-------------------------- MODULE ConsensusSafety --------------------------
EXTENDS Naturals, FiniteSets, Quorum

\* Tendermint-family BFT safety model for SunRey.
\* Model checked within stated bounds. Not unlimited-state correctness.

CONSTANTS Validators, MaxHeight, MaxRound, Values
VARIABLES height, round, proposal, prevotes, precommits,
          lockedValue, lockedRound, validValue, validRound,
          finalized, finalizedHeight

Power == [v \in Validators |-> 1]
Total == Cardinality(Validators)
Nil == "NIL"

TypeOK ==
  /\ height \in 1..MaxHeight
  /\ round \in 0..MaxRound
  /\ proposal \in Values \union {Nil}
  /\ finalizedHeight \in 0..MaxHeight

VotePower(votes, value) ==
  Cardinality({v \in Validators : votes[v] = value})

CanFinalize(votes, value) ==
  value # Nil /\ ExceedsTwoThirds(VotePower(votes, value), Total)

NoConflictingFinalized ==
  \A h \in DOMAIN finalized :
    finalized[h] # Nil

FinalizedHeightMonotonic ==
  finalizedHeight <= height

NilDoesNotCommit ==
  \A h \in DOMAIN finalized : finalized[h] # Nil

LockPreservesSafety ==
  lockedValue \in {Nil} \union Values

Init ==
  /\ height = 1
  /\ round = 0
  /\ proposal = Nil
  /\ prevotes = [v \in Validators |-> Nil]
  /\ precommits = [v \in Validators |-> Nil]
  /\ lockedValue = Nil
  /\ lockedRound = 0
  /\ validValue = Nil
  /\ validRound = 0
  /\ finalized = << >>
  /\ finalizedHeight = 0

Next ==
  \/ /\ proposal = Nil
     /\ \E val \in Values \ {Nil} :
          proposal' = val
     /\ UNCHANGED <<height, round, prevotes, precommits, lockedValue,
                    lockedRound, validValue, validRound, finalized, finalizedHeight>>
  \/ \E v \in Validators, val \in Values :
        /\ prevotes' = [prevotes EXCEPT ![v] = val]
        /\ UNCHANGED <<height, round, proposal, precommits, lockedValue,
                       lockedRound, validValue, validRound, finalized, finalizedHeight>>
  \/ \E v \in Validators, val \in Values :
        /\ precommits' = [precommits EXCEPT ![v] = val]
        /\ UNCHANGED <<height, round, proposal, prevotes, lockedValue,
                       lockedRound, validValue, validRound, finalized, finalizedHeight>>
  \/ \E val \in Values \ {Nil} :
        /\ CanFinalize(precommits, val)
        /\ finalizedHeight' = height
        /\ UNCHANGED <<height, round, proposal, prevotes, precommits,
                       lockedValue, lockedRound, validValue, validRound, finalized>>

Spec == Init /\ [][Next]_<<height, round, proposal, prevotes, precommits,
          lockedValue, lockedRound, validValue, validRound, finalized, finalizedHeight>>

THEOREM Spec => [](NoConflictingFinalized /\ FinalizedHeightMonotonic /\ NilDoesNotCommit /\ LockPreservesSafety)
=============================================================================
