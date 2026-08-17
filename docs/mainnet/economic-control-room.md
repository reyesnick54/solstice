# Economic control room

`EconomicLaunchControlRoomState` extends the Chunk 70
`LaunchControlRoomState` with economic readiness indicators:

- monetary policy
- SunRey supply
- MoonRey supply
- fees
- validator economics
- oracle health
- productive issuance
- treasury
- Exchange
- economic RC
- economic stress status
- active governance version

`productionActivated` remains `false`. `liveFlagsRemainDisabled` remains
`true`.

Read the room with:

```
npm run sunrey-launch -- economic-status
```
