# Oracle provider development (simulation)

Simulation / local development only. This is not a production
market-data onboarding procedure.

## 1. Choose a classification

Provider class is not legal approval. Use one of:

`INSTITUTIONAL_DATA_PROVIDER`, `REGULATED_PROVIDER`,
`ENTERPRISE_SENSOR_NETWORK`, `DEVICE_ORACLE`, `ATTESTATION_PROVIDER`,
`AUDITOR`, `PUBLIC_DATA_PROVIDER`, `COMPOSITE_ORACLE`.

## 2. Derive a development oracle key

Keys are CryptoSuite-routed with purpose `ORACLE_SIGNING`. The CLI
never prints signing secrets. Development seeds are labels, not
production key infrastructure.

## 3. Register the provider and feed

```
sunrey-node oracle demo --data-dir /tmp/sunrey-oracle
sunrey-node oracle providers --data-dir /tmp/sunrey-oracle
sunrey-node oracle feeds --data-dir /tmp/sunrey-oracle
```

The TypeScript demo (`npm run demo:sunrey-oracle`) registers three
simulated energy providers and an energy-production feed, then a
compute-usage feed.

## 4. Submit signed observations

Off-chain adapters collect values. They must not be imported by
consensus execution. Submit only signed `OracleObservation`
transactions. Huge payloads are rejected by the resource meter.

## 5. Query

```
sunrey-node oracle observation <id> --data-dir /tmp/sunrey-oracle
sunrey-node oracle fact <id> --data-dir /tmp/sunrey-oracle
sunrey-node oracle facts --feed feed_energy_production_sim --data-dir /tmp/sunrey-oracle
sunrey-node oracle quality --data-dir /tmp/sunrey-oracle
```

RPC equivalents: `/oracle/providers`, `/oracle/feeds`,
`/oracle/observation/:id`, `/oracle/fact/:id`, `/oracle/facts?feed=`,
`/oracle/disputes`, `/oracle/quality`.
