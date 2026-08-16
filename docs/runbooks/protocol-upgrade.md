# Protocol upgrade runbook (development)

Simulation / local development only. This is not a production network
procedure.

## 1. Publish the artifact

Record source commit, toolchain, module hashes, schema hashes, and
the release artifact hash. Do not claim a reproducible build unless
CI actually reproduced the artifact.

```
node scripts/sunrey-release-manifest.mjs
```

## 2. Propose

```
sunrey-node governance propose \
  --data-dir /tmp/sunrey-dev \
  --id upg_param_1 \
  --kind CONSENSUS_PARAMETER_CHANGE \
  --activation-height 16 \
  --max-transactions 64
```

## 3. Vote

Governance keys are derived from development labels. The CLI never
prints signing secrets.

```
sunrey-node governance vote --data-dir /tmp/sunrey-dev --id upg_param_1 --voter gov_validator_1 --choice APPROVE
sunrey-node governance vote --data-dir /tmp/sunrey-dev --id upg_param_1 --voter gov_validator_2 --choice APPROVE
sunrey-node governance vote --data-dir /tmp/sunrey-dev --id upg_param_1 --voter gov_validator_3 --choice APPROVE
```

Required development power is `3` of `4`.

## 4. Schedule and wait for height

```
sunrey-node governance schedule --data-dir /tmp/sunrey-dev --id upg_param_1
sunrey-node governance readiness --data-dir /tmp/sunrey-dev --id upg_param_1
```

Blocks before `H` keep the previous parameter hash. The block at `H`
commits the new hashes. If app hashes diverge, halt producers and
inspect `sunrey-node governance history`.

## 5. Cancel before activation

```
sunrey-node governance cancel --data-dir /tmp/sunrey-dev --id upg_param_1 --actor gov_operator_1
```

Cancellation is signed and finalized. Do not edit `governance.json`
by hand.
