------------------------- MODULE CapabilityActivationSafety -------------------------
EXTENDS Naturals

VARIABLES network, capability, authority, evidence, exchangeEnabled, custodyEnabled, fiatEnabled, restriction, finalizedUnchanged

Init ==
  /\ network = "REHEARSAL"
  /\ capability = "CHAIN"
  /\ authority = "NONE"
  /\ evidence = "MISSING"
  /\ exchangeEnabled = FALSE
  /\ custodyEnabled = FALSE
  /\ fiatEnabled = FALSE
  /\ restriction = "INACTIVE"
  /\ finalizedUnchanged = TRUE

Next ==
  \/ capability' = "EXCHANGE" /\ UNCHANGED <<network, authority, evidence, exchangeEnabled, custodyEnabled, fiatEnabled, restriction, finalizedUnchanged>>
  \/ authority' = "HUMAN" /\ UNCHANGED <<network, capability, evidence, exchangeEnabled, custodyEnabled, fiatEnabled, restriction, finalizedUnchanged>>
  \/ authority' = "AI" /\ UNCHANGED <<network, capability, evidence, exchangeEnabled, custodyEnabled, fiatEnabled, restriction, finalizedUnchanged>>
  \/ evidence' = "PRESENT" /\ UNCHANGED <<network, capability, authority, exchangeEnabled, custodyEnabled, fiatEnabled, restriction, finalizedUnchanged>>
  \/ network' = "WRONG" /\ UNCHANGED <<capability, authority, evidence, exchangeEnabled, custodyEnabled, fiatEnabled, restriction, finalizedUnchanged>>
  \/ restriction' = "ACTIVE" /\ exchangeEnabled' = FALSE /\ custodyEnabled' = FALSE /\ fiatEnabled' = FALSE /\ UNCHANGED <<network, capability, authority, evidence, finalizedUnchanged>>

WrongNetworkCannotActivate == network = "WRONG" => (exchangeEnabled = FALSE /\ custodyEnabled = FALSE /\ fiatEnabled = FALSE)
MissingAuthorityCannotActivate == authority # "HUMAN" => (exchangeEnabled = FALSE /\ custodyEnabled = FALSE /\ fiatEnabled = FALSE)
AiCannotActivate == authority = "AI" => (exchangeEnabled = FALSE /\ custodyEnabled = FALSE /\ fiatEnabled = FALSE)
RegulatedDoesNotInheritChain == exchangeEnabled = FALSE /\ custodyEnabled = FALSE /\ fiatEnabled = FALSE
RestrictionEnforced == restriction = "ACTIVE" => (exchangeEnabled = FALSE /\ custodyEnabled = FALSE /\ fiatEnabled = FALSE)
HistoricFinalizedUnchanged == finalizedUnchanged = TRUE
Spec == Init /\ [][Next]_<<network, capability, authority, evidence, exchangeEnabled, custodyEnabled, fiatEnabled, restriction, finalizedUnchanged>>
=============================================================================
