# Launch control room

Chunk 70 rehearsal uses `LaunchControlRoomState`. Chunk 88 production
genesis execution uses `ProductionLaunchControlRoomState`. The
production object aggregates the live launch picture:

- authorization
- release / Mainnet RC
- Candidate V2
- provider health
- validator readiness
- signer readiness
- network, storage, and database readiness
- observability and backup
- security findings
- external readiness
- genesis status
- first-block status

`productionActivated` remains false. `liveFlagsRemainDisabled` remains
true. Control-room state is not a capability-activation matrix.

See [chunk-88-genesis-execution.md](./chunk-88-genesis-execution.md)
and the earlier rehearsal control room at [control-room.md](./control-room.md).
