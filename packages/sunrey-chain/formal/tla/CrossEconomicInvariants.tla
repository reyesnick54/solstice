---------------------- MODULE CrossEconomicInvariants ----------------------
EXTENDS Naturals

VARIABLES charged, reward, burned, treasury, sunreyIssued, sunreyCirc, moonreyIssued, moonreyAuth, moonreyCirc

Init ==
  /\ charged = 0 /\ reward = 0 /\ burned = 0 /\ treasury = 0
  /\ sunreyIssued = 0 /\ sunreyCirc = 0
  /\ moonreyIssued = 0 /\ moonreyAuth = 0 /\ moonreyCirc = 0

IssueSun == sunreyIssued' = sunreyIssued + 1 /\ sunreyCirc' = sunreyCirc + 1
  /\ UNCHANGED <<charged, reward, burned, treasury, moonreyIssued, moonreyAuth, moonreyCirc>>
AuthMoon == moonreyAuth' = moonreyAuth + 1
  /\ UNCHANGED <<charged, reward, burned, treasury, sunreyIssued, sunreyCirc, moonreyIssued, moonreyCirc>>
IssueMoon == moonreyAuth > moonreyIssued /\ moonreyIssued' = moonreyIssued + 1 /\ moonreyCirc' = moonreyCirc + 1
  /\ UNCHANGED <<charged, reward, burned, treasury, sunreyIssued, sunreyCirc, moonreyAuth>>
ChargeReward == sunreyCirc > 0 /\ charged' = charged + 1 /\ reward' = reward + 1 /\ sunreyCirc' = sunreyCirc - 1
  /\ UNCHANGED <<burned, treasury, sunreyIssued, moonreyIssued, moonreyAuth, moonreyCirc>>
ChargeBurn == sunreyCirc > 0 /\ charged' = charged + 1 /\ burned' = burned + 1 /\ sunreyCirc' = sunreyCirc - 1
  /\ UNCHANGED <<reward, treasury, sunreyIssued, moonreyIssued, moonreyAuth, moonreyCirc>>

Next == IssueSun \/ AuthMoon \/ IssueMoon \/ ChargeReward \/ ChargeBurn
FeeRewardConserved == reward + burned + treasury = charged
MoonAuth == moonreyIssued <= moonreyAuth
Spec == Init /\ [][Next]_<<charged, reward, burned, treasury, sunreyIssued, sunreyCirc, moonreyIssued, moonreyAuth, moonreyCirc>>
=============================================================================
