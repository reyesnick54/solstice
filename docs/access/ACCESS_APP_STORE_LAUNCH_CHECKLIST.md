# Access V1 — App Store / Consumer Product Launch Checklist

Engineering checklist only. Does **not** assert Apple App Store or Google Play approval.

## Legal and policy links

- [ ] Terms of Service link live and versioned for Access redemption
- [ ] Privacy Policy link covers provider data sharing and booking metadata
- [ ] Refund and cancellation policy accessible pre-checkout
- [ ] Access entitlement disclaimer: non-cash, non-withdrawable, not guaranteed
- [ ] No misleading token / yield / APY language in UI copy

## Provider attribution

- [ ] Provider name displayed on opportunity detail and confirmation
- [ ] Provider terms linked where contract requires
- [ ] Third-party booking disclaimers (Turo, Expedia, etc.) per partner agreement

## Payment and money

- [ ] User co-pay amount shown before confirmation
- [ ] Taxes and fees itemized where available from quote
- [ ] Security deposit shown separately from Access coverage (not charged to Access pool)
- [ ] Payment method handling uses platform PCI boundary (no raw PAN in app logs)
- [ ] Failed payment does not leave orphan provider booking

## Access-specific disclosures

- [ ] Funded redemption availability shown separately from entitlement balance
- [ ] Quote expiration timestamp displayed
- [ ] Access expiration / epoch boundaries explained
- [ ] Partial coverage explained when user contribution required
- [ ] Funding exhaustion message when pool empty but entitlement remains

## Support

- [ ] In-app support entry point
- [ ] Transaction ID copyable for support
- [ ] Support agents can view booking/payment/refund status without payment credentials

## Account and safety

- [ ] Account ownership verification on Access routes
- [ ] Restricted / suspended users blocked from new redemptions
- [ ] Error states user-safe (no stack traces, no internal provider codes)

## Technical

- [ ] Production builds do not silently use simulation inventory
- [ ] Feature flags documented for Access kill switch
- [ ] Deep links to booking detail and history work offline-cache safe

## Accessibility and UX

- [ ] Checkout review screen summarizes Access applied + user pays + deposit
- [ ] Cancellation flow confirms refund expectations
- [ ] Action Center shows pending / completed Access states (when implemented)

## Pre-launch verification

- [ ] Mustang (or equivalent) E2E demonstrated in staging with sandbox provider
- [ ] Full refund path demonstrated
- [ ] Compliance HOLD path demonstrated
- [ ] Provider outage degradation demonstrated
