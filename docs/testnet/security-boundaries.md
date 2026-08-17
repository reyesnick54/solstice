# Security boundaries

Mandatory guarantees:

- Validator keys are not present on public RPC hosts.
- Fixture keys are rejected outside fixture environments.
- The faucet cannot govern.
- The faucet cannot validate.
- Explorer cannot mutate the chain.
- RPC cannot access the validator signer.
- Relayer cannot govern.
- Testnet configuration cannot enable production banking rails.

Faucet credentials are separate from validator keys, governance keys,
and custody production concepts. Faucet authorization is valid only
for designated test networks.

No private key values appear in committed YAML.
