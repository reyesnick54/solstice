# Polymarket prediction bot (assimilation reference)

This directory documents the **external OSS reference** for HELIOS NATIVE13 assimilation.
Runtime code lives in native HELIOS packages; **private keys, wallet signing, and live
Polymarket trading were intentionally not ported**.

Native targets:

- `packages/platform/src/helios/prediction-market/`
- `packages/external-data/src/prediction-market/`
- `packages/strategy-lab/src/prediction-market/`

Qualification marker: `HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED`

**Security:** NATIVE02 classified this upstream tree as **DO_NOT_PORT** at audit SHA `1f7c9761ddd26863242e3ed4f83c230ee38aebeb`. The committed snapshot is quarantined for static review only.
