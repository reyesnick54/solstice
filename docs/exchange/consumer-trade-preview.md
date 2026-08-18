# Consumer trade preview

`ConsumerTradePreview` is shown before wallet or mobile
authorization. It includes:

- side and flow (`BUY`, `SELL`, `CONVERT`)
- asset received and asset spent
- quantity
- estimated execution price
- price protection
- estimated fee (configured simulation schedule only)
- custody/wallet effect
- market state
- risk/disclosure references
- human-readable trade intent

API session authentication is not authorization to spend. The
preview text must match the signed intent display.
