# Resource metering (FeePolicyV2)

Metering is a pure function of transaction bytes and protocol state.

```
usage = meter(tx_bytes, declared_signature_class, operation, oracle/interop/dvp counts)
weighted = Σ usage[class] × weight[class]
```

Weights live on a versioned `ResourceWeightSchedule`. Development
fixtures exist. Production weights remain unconfigured.

PQ and hybrid signatures consume different governed units. The class is
a declared protocol attribute. Real-time verification duration is not
metered.

Oracle metering covers on-chain observation/fact verification only.
External collector API activity is not consensus work.

Interop proof classes consume governed `INTEROP_PROOF` units.
Exchange atomic DVP consumes `EXCHANGE_DVP_LEG` units and keeps
settlement atomic.

Machine transactions remain bound by mandate, native balance, and
`max_fee`. Priority fees cannot bypass the mandate.
