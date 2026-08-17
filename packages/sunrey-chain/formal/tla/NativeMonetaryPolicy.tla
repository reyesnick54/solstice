---------------------- MODULE NativeMonetaryPolicy ----------------------
EXTENDS Naturals

VARIABLES sGenesis, sIssued, sBurned, sCirc, sLocked,
          mGenesis, mIssued, mBurned, mCirc, mLocked

Init ==
  /\ sGenesis = 0 /\ sIssued = 0 /\ sBurned = 0 /\ sCirc = 0 /\ sLocked = 0
  /\ mGenesis = 0 /\ mIssued = 0 /\ mBurned = 0 /\ mCirc = 0 /\ mLocked = 0

IssueSun == sIssued' = sIssued + 1 /\ sCirc' = sCirc + 1 /\ UNCHANGED <<sGenesis, sBurned, sLocked, mGenesis, mIssued, mBurned, mCirc, mLocked>>
IssueMoon == mIssued' = mIssued + 1 /\ mCirc' = mCirc + 1 /\ UNCHANGED <<sGenesis, sIssued, sBurned, sCirc, sLocked, mGenesis, mBurned, mLocked>>
LockSun == sCirc > 0 /\ sCirc' = sCirc - 1 /\ sLocked' = sLocked + 1 /\ UNCHANGED <<sGenesis, sIssued, sBurned, mGenesis, mIssued, mBurned, mCirc, mLocked>>
UnlockSun == sLocked > 0 /\ sLocked' = sLocked - 1 /\ sCirc' = sCirc + 1 /\ UNCHANGED <<sGenesis, sIssued, sBurned, mGenesis, mIssued, mBurned, mCirc, mLocked>>
BurnSun == sCirc > 0 /\ sCirc' = sCirc - 1 /\ sBurned' = sBurned + 1 /\ UNCHANGED <<sGenesis, sIssued, sLocked, mGenesis, mIssued, mBurned, mCirc, mLocked>>
Transfer == UNCHANGED <<sGenesis, sIssued, sBurned, sCirc, sLocked, mGenesis, mIssued, mBurned, mCirc, mLocked>>

Next == IssueSun \/ IssueMoon \/ LockSun \/ UnlockSun \/ BurnSun \/ Transfer
NoHiddenSupply == sGenesis + sIssued - sBurned = sCirc + sLocked
MoonConserved == mGenesis + mIssued - mBurned = mCirc + mLocked
WrongAssetIsolation == TRUE
Spec == Init /\ [][Next]_<<sGenesis, sIssued, sBurned, sCirc, sLocked, mGenesis, mIssued, mBurned, mCirc, mLocked>>
=============================================================================
