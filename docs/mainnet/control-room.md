# Launch control room

`LaunchControlRoomState` is the machine-readable rehearsal status object.

Tracked gates:

- release verified
- genesis verified
- validators ready
- signers ready
- network paths ready
- storage ready
- RPC ready
- Explorer ready
- oracle ready
- backup ready
- monitoring ready
- incidents
- finalized height

The control room never sets `productionActivated`. `liveFlagsRemainDisabled`
is always `true`.

AI may summarize status. AI cannot impersonate required human
authorization.
