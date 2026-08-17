------------------------- MODULE InteropPacketState -------------------------
EXTENDS Naturals

VARIABLES status, executed, acked, timedOut, client

Init == status = "NONE" /\ executed = 0 /\ acked = 0 /\ timedOut = 0 /\ client = "ACTIVE"

Send == client = "ACTIVE" /\ status = "NONE" /\ status' = "SENT" /\ UNCHANGED <<executed, acked, timedOut, client>>
Receive == client = "ACTIVE" /\ status = "SENT" /\ status' = "RECEIVED" /\ executed' = executed + 1 /\ UNCHANGED <<acked, timedOut, client>>
Ack == status = "RECEIVED" /\ status' = "ACKNOWLEDGED" /\ acked' = acked + 1 /\ UNCHANGED <<executed, timedOut, client>>
Timeout == status = "SENT" /\ status' = "TIMED_OUT" /\ timedOut' = timedOut + 1 /\ UNCHANGED <<executed, acked, client>>

Next == Send \/ Receive \/ Ack \/ Timeout
AtMostOnce == executed <= 1
AckAtMostOnce == acked <= 1
NoDualEffect == ~(acked > 0 /\ timedOut > 0)
Spec == Init /\ [][Next]_<<status, executed, acked, timedOut, client>>
=============================================================================
