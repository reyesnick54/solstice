# Local SunRey development network

Simulation / development only. Not a public network.

## One command

```bash
npm run demo:sunrey-devnet
```

This runs the required three-node scenario in-process: authenticated
peers, transaction gossip, block gossip, restart catch-up,
wrong-genesis rejection, and malformed-input health.

## Start Node A, B, and C as processes

```bash
bash scripts/sunrey-devnet.sh
```

The script starts three `sunrey-node` processes with:

- the same development genesis
- unique node identities
- unique P2P ports (41001–41003)
- unique operator ports (42001–42003)
- isolated data directories under `/tmp/sunrey-devnet-abc`

Readiness is the operator `GET /ready` probe, not a fixed sleep.

Stop with Ctrl-C. The script tears down the child processes.
