//! Dual native asset protocol for SunRey Coin and MoonRey Coin.
//!
//! Protocol-native assets. Not ERC-20, not Ethereum contracts, not a
//! second application ledger. Development chain state is
//! `NATIVE_BLOCKCHAIN_AUTHORITY` and does not import application supply.

pub mod apply;
pub mod authority;
pub mod crypto_policy;
pub mod error;
pub mod exchange;
pub mod faucet;
pub mod issuance;
pub mod migration;
pub mod policy;
pub mod quantity;
pub mod registry;
pub mod settlement;
pub mod state;
pub mod transaction;

pub use apply::{apply_native_asset, ApplyContext};
pub use authority::{AssetAuthority, AuthorityBoundary};
pub use crypto_policy::{AssetCrypto, CryptoClass, CryptoPolicy};
pub use error::AssetError;
pub use exchange::{
    NativeAssetSettlementAdapter, NativeAssetSettlementPort, SettlementDvp, SettlementHold,
    SettlementTransfer,
};
pub use faucet::{
    faucet_notice, faucet_payload, faucet_permitted, require_faucet_environment, FaucetRequest,
};
pub use issuance::{
    DevelopmentMoonReyIssuanceAuthority, DevelopmentSunReyIssuanceAuthority,
    EconomicAuthorizationArtifact, IssuanceAuthorization, IssuanceVerifyCtx,
    MoonReyIssuanceAuthorityPort, SunReyNativeIssuanceAuthority, DEVELOPMENT_FAUCET_POLICY,
    DEV_FAUCET_ISSUER, MOONREY_ISSUANCE_POLICY, SUNREY_ISSUANCE_POLICY,
};
pub use migration::AssetMigrationManifest;
pub use policy::{AssetPolicy, PolicyDecision, PolicyReason};
pub use quantity::AssetQuantity;
pub use registry::{
    NativeAssetDefinition, NativeAssetId, NativeAssetRegistry, TICKER_STATUS_NOT_ASSIGNED,
};
pub use settlement::{
    apply_exchange_settlement, apply_settlement_batch, BatchApplyResult, BatchMode,
    ExchangeSettlementAuthority, ExchangeSettlementPayload, SettlementApplyContext,
    SettlementBatch, SettlementLeg, SettlementLegKind, SettlementSource,
    EXCHANGE_SETTLEMENT_ISSUER, EXCHANGE_SETTLEMENT_POLICY, EXCHANGE_SETTLEMENT_TAG,
    MAX_BATCH_BYTES, MAX_BATCH_EXECUTION_UNITS, MAX_BATCH_LEGS, MAX_BATCH_TRADES,
    SETTLEMENT_TX_VERSION,
};
pub use state::ExchangeSettlementRecord;
pub use state::{
    AssetBurnRecord, AssetHolding, AssetIssuanceRecord, AssetLock, AssetSupplyState,
    AssetTransferRecord, LockPurpose, LockStatus, NativeAssetLedger,
};
pub use transaction::{NativeAssetOp, NativeAssetPayload};

pub const LEDGER_STORE_KEY: &[u8] = b"native-ledger-v1";

#[cfg(test)]
mod tests {
    use super::*;
    use crate::authority::ECONOMIC_UNIT_LABEL_DEVELOPMENT;
    use crate::faucet::FAUCET_ACTOR;
    use crate::issuance::DEV_FAUCET_ISSUER;

    struct TestCrypto;

    impl AssetCrypto for TestCrypto {
        fn suite_id(&self) -> &str {
            "TEST_SUITE"
        }
        fn algorithm_id(&self) -> &str {
            "TEST_ALG"
        }
        fn verify(
            &self,
            public_key: &[u8],
            message: &[u8],
            signature: &[u8],
        ) -> Result<(), AssetError> {
            if public_key == signature && !message.is_empty() && public_key == [0x11; 32] {
                Ok(())
            } else {
                Err(AssetError::InvalidSignature)
            }
        }
    }

    fn policy() -> CryptoPolicy {
        CryptoPolicy::development_classical("TEST_SUITE", "TEST_ALG")
    }

    fn ctx<'a>(
        height: u64,
        crypto: &'a TestCrypto,
        policy: &'a CryptoPolicy,
        auth: Option<&'a IssuanceAuthorization>,
    ) -> ApplyContext<'a> {
        ApplyContext {
            height,
            network_id: "net_sunrey_local_dev",
            chain_id: "chn_sunrey_local_dev",
            environment: "simulation",
            production_network_enabled: false,
            protocol_version: 1,
            crypto,
            crypto_policy: policy,
            authorization: auth,
        }
    }

    fn signed_auth(
        id: &str,
        asset: NativeAssetId,
        recipient: &str,
        qty: u128,
        policy_id: &str,
    ) -> IssuanceAuthorization {
        let mut auth = IssuanceAuthorization {
            authorization_id: id.to_string(),
            asset_id: asset,
            recipient: recipient.to_string(),
            quantity: qty,
            issuance_policy: policy_id.to_string(),
            proof_reference: format!("faucet:{id}"),
            governance_policy_reference: "gov.native.dev.v1".to_string(),
            expiration_height: 10_000,
            issuer: DEV_FAUCET_ISSUER.to_string(),
            suite_id: "TEST_SUITE".to_string(),
            algorithm_id: "TEST_ALG".to_string(),
            public_key: vec![0x11; 32],
            signature: vec![0x11; 32],
            network_id: "net_sunrey_local_dev".to_string(),
            chain_id: "chn_sunrey_local_dev".to_string(),
        };
        auth.signature = auth.public_key.clone();
        auth
    }

    fn issue(
        ledger: &mut NativeAssetLedger,
        asset: NativeAssetId,
        recipient: &str,
        qty: u128,
        auth_id: &str,
        height: u64,
    ) {
        let crypto = TestCrypto;
        let policy = policy();
        let auth = signed_auth(auth_id, asset, recipient, qty, DEVELOPMENT_FAUCET_POLICY);
        let payload = NativeAssetPayload {
            version: 1,
            op: NativeAssetOp::Issue,
            actor_id: FAUCET_ACTOR.to_string(),
            asset_id: asset,
            quantity: qty,
            counterparty: recipient.to_string(),
            lock_id: String::new(),
            lock_purpose: None,
            expiration_height: None,
            authorized_releaser: String::new(),
            authorization_id: auth_id.to_string(),
            issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
            proof_reference: format!("faucet:{auth_id}"),
            economic_unit_label: ECONOMIC_UNIT_LABEL_DEVELOPMENT.to_string(),
        };
        apply_native_asset(ledger, &payload, &ctx(height, &crypto, &policy, Some(&auth))).unwrap();
    }

    #[test]
    fn sunrey_and_moonrey_are_distinct_and_tickers_unassigned() {
        let registry = NativeAssetRegistry::development();
        let sun = registry.get(NativeAssetId::SunReyCoin).unwrap();
        let moon = registry.get(NativeAssetId::MoonReyCoin).unwrap();
        assert_ne!(sun.asset_id, moon.asset_id);
        assert_eq!(sun.ticker_status, TICKER_STATUS_NOT_ASSIGNED);
        assert_eq!(moon.ticker_status, TICKER_STATUS_NOT_ASSIGNED);
        assert_eq!(sun.display_name, "SunRey Coin");
        assert_eq!(moon.display_name, "MoonRey Coin");
        assert_eq!(sun.precision, 6);
        assert_eq!(moon.precision, 6);
    }

    #[test]
    fn cross_asset_arithmetic_rejected() {
        let a = AssetQuantity::new(NativeAssetId::SunReyCoin, 10).unwrap();
        let b = AssetQuantity::new(NativeAssetId::MoonReyCoin, 10).unwrap();
        assert_eq!(a.checked_add(b).unwrap_err(), AssetError::CrossAssetArithmetic);
        assert_eq!(a.checked_sub(b).unwrap_err(), AssetError::CrossAssetArithmetic);
    }

    #[test]
    fn overflow_rejected() {
        let a = AssetQuantity::new(NativeAssetId::SunReyCoin, AssetQuantity::MAX).unwrap();
        let one = AssetQuantity::new(NativeAssetId::SunReyCoin, 1).unwrap();
        assert_eq!(a.checked_add(one).unwrap_err(), AssetError::Overflow);
        assert_eq!(a.checked_mul(2).unwrap_err(), AssetError::Overflow);
        assert_eq!(one.checked_sub(a).unwrap_err(), AssetError::Overflow);
    }

    #[test]
    fn unauthorized_issuance_rejected() {
        let mut ledger = NativeAssetLedger::development();
        let crypto = TestCrypto;
        let policy = policy();
        let payload = NativeAssetPayload {
            version: 1,
            op: NativeAssetOp::Issue,
            actor_id: "alice".to_string(),
            asset_id: NativeAssetId::MoonReyCoin,
            quantity: 50,
            counterparty: "alice".to_string(),
            lock_id: String::new(),
            lock_purpose: None,
            expiration_height: None,
            authorized_releaser: String::new(),
            authorization_id: "nope".to_string(),
            issuance_policy: String::new(),
            proof_reference: String::new(),
            economic_unit_label: String::new(),
        };
        let err =
            apply_native_asset(&mut ledger, &payload, &ctx(1, &crypto, &policy, None)).unwrap_err();
        assert_eq!(err, AssetError::UnauthorizedIssuance);
    }

    #[test]
    fn issuance_replay_rejected() {
        let mut ledger = NativeAssetLedger::development();
        issue(&mut ledger, NativeAssetId::SunReyCoin, "alice", 100, "auth-1", 1);
        let crypto = TestCrypto;
        let policy = policy();
        let auth = signed_auth(
            "auth-1",
            NativeAssetId::SunReyCoin,
            "alice",
            100,
            DEVELOPMENT_FAUCET_POLICY,
        );
        let payload = NativeAssetPayload {
            version: 1,
            op: NativeAssetOp::Issue,
            actor_id: FAUCET_ACTOR.to_string(),
            asset_id: NativeAssetId::SunReyCoin,
            quantity: 100,
            counterparty: "alice".to_string(),
            lock_id: String::new(),
            lock_purpose: None,
            expiration_height: None,
            authorized_releaser: String::new(),
            authorization_id: "auth-1".to_string(),
            issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
            proof_reference: "faucet:auth-1".to_string(),
            economic_unit_label: ECONOMIC_UNIT_LABEL_DEVELOPMENT.to_string(),
        };
        let err = apply_native_asset(&mut ledger, &payload, &ctx(2, &crypto, &policy, Some(&auth)))
            .unwrap_err();
        assert_eq!(err, AssetError::IssuanceReplay);
    }

    #[test]
    fn transfer_succeeds_and_overspend_rejected() {
        let mut ledger = NativeAssetLedger::development();
        issue(&mut ledger, NativeAssetId::SunReyCoin, "alice", 100, "a1", 1);
        let crypto = TestCrypto;
        let policy = policy();
        let ok = NativeAssetPayload::transfer(
            "alice",
            "bob",
            AssetQuantity::new(NativeAssetId::SunReyCoin, 40).unwrap(),
        );
        apply_native_asset(&mut ledger, &ok, &ctx(2, &crypto, &policy, None)).unwrap();
        assert_eq!(ledger.available("alice", NativeAssetId::SunReyCoin), 60);
        assert_eq!(ledger.available("bob", NativeAssetId::SunReyCoin), 40);
        let over = NativeAssetPayload::transfer(
            "alice",
            "bob",
            AssetQuantity::new(NativeAssetId::SunReyCoin, 61).unwrap(),
        );
        assert_eq!(
            apply_native_asset(&mut ledger, &over, &ctx(3, &crypto, &policy, None)).unwrap_err(),
            AssetError::InsufficientAsset
        );
    }

    #[test]
    fn locked_funds_unavailable_then_unlock_succeeds() {
        let mut ledger = NativeAssetLedger::development();
        issue(&mut ledger, NativeAssetId::MoonReyCoin, "alice", 80, "m1", 1);
        let crypto = TestCrypto;
        let policy = policy();
        let lock = NativeAssetPayload {
            version: 1,
            op: NativeAssetOp::Lock,
            actor_id: "alice".to_string(),
            asset_id: NativeAssetId::MoonReyCoin,
            quantity: 50,
            counterparty: String::new(),
            lock_id: "lock-1".to_string(),
            lock_purpose: Some(LockPurpose::Escrow),
            expiration_height: None,
            authorized_releaser: "alice".to_string(),
            authorization_id: String::new(),
            issuance_policy: String::new(),
            proof_reference: String::new(),
            economic_unit_label: String::new(),
        };
        apply_native_asset(&mut ledger, &lock, &ctx(2, &crypto, &policy, None)).unwrap();
        let spend_locked = NativeAssetPayload::transfer(
            "alice",
            "bob",
            AssetQuantity::new(NativeAssetId::MoonReyCoin, 40).unwrap(),
        );
        assert_eq!(
            apply_native_asset(&mut ledger, &spend_locked, &ctx(3, &crypto, &policy, None))
                .unwrap_err(),
            AssetError::AssetLocked
        );
        let unlock = NativeAssetPayload {
            version: 1,
            op: NativeAssetOp::Unlock,
            actor_id: "alice".to_string(),
            asset_id: NativeAssetId::MoonReyCoin,
            quantity: 50,
            counterparty: String::new(),
            lock_id: "lock-1".to_string(),
            lock_purpose: Some(LockPurpose::Escrow),
            expiration_height: None,
            authorized_releaser: "alice".to_string(),
            authorization_id: String::new(),
            issuance_policy: String::new(),
            proof_reference: String::new(),
            economic_unit_label: String::new(),
        };
        apply_native_asset(&mut ledger, &unlock, &ctx(4, &crypto, &policy, None)).unwrap();
        apply_native_asset(&mut ledger, &spend_locked, &ctx(5, &crypto, &policy, None)).unwrap();
        assert_eq!(ledger.available("bob", NativeAssetId::MoonReyCoin), 40);
    }

    #[test]
    fn burn_changes_supply_and_reconciliation_is_exact() {
        let mut ledger = NativeAssetLedger::development();
        issue(&mut ledger, NativeAssetId::SunReyCoin, "alice", 100, "b1", 1);
        let crypto = TestCrypto;
        let policy = policy();
        let burn = NativeAssetPayload {
            version: 1,
            op: NativeAssetOp::Burn,
            actor_id: "alice".to_string(),
            asset_id: NativeAssetId::SunReyCoin,
            quantity: 25,
            counterparty: String::new(),
            lock_id: String::new(),
            lock_purpose: None,
            expiration_height: None,
            authorized_releaser: String::new(),
            authorization_id: String::new(),
            issuance_policy: String::new(),
            proof_reference: String::new(),
            economic_unit_label: String::new(),
        };
        apply_native_asset(&mut ledger, &burn, &ctx(2, &crypto, &policy, None)).unwrap();
        let supply = ledger.supply(NativeAssetId::SunReyCoin);
        assert_eq!(supply.issued, 100);
        assert_eq!(supply.burned, 25);
        assert_eq!(supply.circulating, 75);
        ledger.reconcile_all().unwrap();
    }

    #[test]
    fn wrong_chain_and_wrong_suite_rejected() {
        let crypto = TestCrypto;
        let policy = policy();
        let mut auth =
            signed_auth("x", NativeAssetId::SunReyCoin, "alice", 10, DEVELOPMENT_FAUCET_POLICY);
        auth.chain_id = "chn_other".to_string();
        let mut ledger = NativeAssetLedger::development();
        let payload = faucet_payload(&FaucetRequest {
            asset_id: NativeAssetId::SunReyCoin,
            recipient: "alice".to_string(),
            quantity: 10,
            authorization_id: "x".to_string(),
        })
        .unwrap();
        assert_eq!(
            apply_native_asset(&mut ledger, &payload, &ctx(1, &crypto, &policy, Some(&auth)))
                .unwrap_err(),
            AssetError::WrongChain
        );
        auth.chain_id = "chn_sunrey_local_dev".to_string();
        auth.suite_id = "OTHER_SUITE".to_string();
        assert_eq!(
            apply_native_asset(&mut ledger, &payload, &ctx(1, &crypto, &policy, Some(&auth)))
                .unwrap_err(),
            AssetError::InvalidCryptoSuite
        );
    }

    #[test]
    fn application_supply_not_imported_and_faucet_blocked_in_production() {
        let boundary = AuthorityBoundary::development();
        assert!(!boundary.application_supply_imported);
        assert!(!boundary.production_migration_performed);
        assert_eq!(boundary.native_chain, AssetAuthority::NativeBlockchainAuthority);
        let ledger = NativeAssetLedger::development();
        assert_eq!(ledger.supply(NativeAssetId::SunReyCoin).issued, 0);
        assert_eq!(
            require_faucet_environment("production", true, "net_sunrey_main").unwrap_err(),
            AssetError::FaucetForbidden
        );
        assert!(faucet_permitted("simulation", false, "net_sunrey_local_dev"));
    }

    #[test]
    fn ledger_round_trip_and_identical_commitments() {
        let mut a = NativeAssetLedger::development();
        issue(&mut a, NativeAssetId::SunReyCoin, "alice", 70, "r1", 1);
        issue(&mut a, NativeAssetId::MoonReyCoin, "bob", 30, "r2", 2);
        let bytes = a.canonical_bytes();
        let b = NativeAssetLedger::decode(&bytes).unwrap();
        assert_eq!(a.canonical_bytes(), b.canonical_bytes());
        let manifest = AssetMigrationManifest::development_fixture();
        manifest.validate_schema().unwrap();
        assert!(!manifest.production_migration_performed);
    }

    fn signed_settlement_auth(settlement_id: &str, nonce: u64) -> ExchangeSettlementAuthority {
        let mut auth = ExchangeSettlementAuthority {
            settlement_id: settlement_id.to_string(),
            issuer: EXCHANGE_SETTLEMENT_ISSUER.to_string(),
            policy_version: EXCHANGE_SETTLEMENT_POLICY.to_string(),
            network_id: "net_sunrey_local_dev".to_string(),
            chain_id: "chn_sunrey_local_dev".to_string(),
            nonce,
            expiration_height: 10_000,
            suite_id: "TEST_SUITE".to_string(),
            algorithm_id: "TEST_ALG".to_string(),
            public_key: vec![0x11; 32],
            signature: vec![],
        };
        auth.signature = auth.public_key.clone();
        auth
    }

    struct DvpSpec {
        settlement_id: &'static str,
        trade_id: &'static str,
        seller_lock: &'static str,
        buyer_lock: &'static str,
        nonce: u64,
        trading_fee: u128,
        network_fee: u128,
    }

    fn dvp_payload(spec: DvpSpec) -> ExchangeSettlementPayload {
        let DvpSpec {
            settlement_id,
            trade_id,
            seller_lock,
            buyer_lock,
            nonce,
            trading_fee,
            network_fee,
        } = spec;
        let fee_to = "fees";
        let mut legs = vec![
            SettlementLeg {
                asset_id: NativeAssetId::SunReyCoin,
                from: "bob".to_string(),
                to: "alice".to_string(),
                quantity: 10,
                source: SettlementSource::Lock { lock_id: seller_lock.to_string() },
                kind: SettlementLegKind::Base,
            },
            SettlementLeg {
                asset_id: NativeAssetId::MoonReyCoin,
                from: "alice".to_string(),
                to: "bob".to_string(),
                quantity: 25,
                source: SettlementSource::Lock { lock_id: buyer_lock.to_string() },
                kind: SettlementLegKind::Quote,
            },
        ];
        if trading_fee > 0 {
            legs.push(SettlementLeg {
                asset_id: NativeAssetId::MoonReyCoin,
                from: "alice".to_string(),
                to: fee_to.to_string(),
                quantity: trading_fee,
                source: SettlementSource::Available,
                kind: SettlementLegKind::TradingFee,
            });
        }
        if network_fee > 0 {
            legs.push(SettlementLeg {
                asset_id: NativeAssetId::SunReyCoin,
                from: "bob".to_string(),
                to: fee_to.to_string(),
                quantity: network_fee,
                source: SettlementSource::Available,
                kind: SettlementLegKind::NetworkFee,
            });
        }
        ExchangeSettlementPayload {
            version: SETTLEMENT_TX_VERSION,
            settlement_id: settlement_id.to_string(),
            trade_ids: vec![trade_id.to_string()],
            buyer: "alice".to_string(),
            seller: "bob".to_string(),
            base_asset: NativeAssetId::SunReyCoin,
            base_quantity: 10,
            quote_asset: NativeAssetId::MoonReyCoin,
            quote_quantity: 25,
            reservation_refs: vec![seller_lock.to_string(), buyer_lock.to_string()],
            expiration_height: 10_000,
            policy_version: EXCHANGE_SETTLEMENT_POLICY.to_string(),
            network_id: "net_sunrey_local_dev".to_string(),
            chain_id: "chn_sunrey_local_dev".to_string(),
            nonce,
            legs,
            authority: signed_settlement_auth(settlement_id, nonce),
        }
    }

    fn lock_for(
        ledger: &mut NativeAssetLedger,
        owner: &str,
        asset: NativeAssetId,
        qty: u128,
        lock_id: &str,
        height: u64,
    ) {
        let crypto = TestCrypto;
        let policy = policy();
        let payload = NativeAssetPayload {
            version: 1,
            op: NativeAssetOp::Lock,
            actor_id: owner.to_string(),
            asset_id: asset,
            quantity: qty,
            counterparty: String::new(),
            lock_id: lock_id.to_string(),
            lock_purpose: Some(LockPurpose::ExchangeOrder),
            expiration_height: None,
            authorized_releaser: EXCHANGE_SETTLEMENT_ISSUER.to_string(),
            authorization_id: String::new(),
            issuance_policy: String::new(),
            proof_reference: String::new(),
            economic_unit_label: String::new(),
        };
        apply_native_asset(ledger, &payload, &ctx(height, &crypto, &policy, None)).unwrap();
    }

    #[test]
    fn settlement_adapter_atomic_dvp_and_insufficient_rolls_back() {
        let mut ledger = NativeAssetLedger::development();
        issue(&mut ledger, NativeAssetId::SunReyCoin, "alice", 20, "s1", 1);
        issue(&mut ledger, NativeAssetId::MoonReyCoin, "bob", 30, "s2", 2);
        let crypto = TestCrypto;
        let policy = policy();
        let apply_ctx = ctx(3, &crypto, &policy, None);
        {
            let mut adapter = NativeAssetSettlementAdapter { ledger: &mut ledger, ctx: &apply_ctx };
            adapter
                .atomic_delivery_versus_payment(SettlementDvp {
                    asset_sender: "alice".to_string(),
                    asset_recipient: "bob".to_string(),
                    asset_quantity: AssetQuantity::new(NativeAssetId::SunReyCoin, 10).unwrap(),
                    contra_asset: NativeAssetId::MoonReyCoin,
                    contra_quantity: 25,
                })
                .unwrap();
            let err = adapter
                .atomic_delivery_versus_payment(SettlementDvp {
                    asset_sender: "alice".to_string(),
                    asset_recipient: "bob".to_string(),
                    asset_quantity: AssetQuantity::new(NativeAssetId::SunReyCoin, 10).unwrap(),
                    contra_asset: NativeAssetId::MoonReyCoin,
                    contra_quantity: 25,
                })
                .unwrap_err();
            assert_eq!(err, AssetError::InsufficientAsset);
        }
        assert_eq!(ledger.available("alice", NativeAssetId::SunReyCoin), 10);
        assert_eq!(ledger.available("bob", NativeAssetId::SunReyCoin), 10);
        assert_eq!(ledger.available("bob", NativeAssetId::MoonReyCoin), 5);
        assert_eq!(ledger.available("alice", NativeAssetId::MoonReyCoin), 25);
    }

    #[test]
    fn exchange_settlement_is_atomic_and_replay_protected() {
        let mut ledger = NativeAssetLedger::development();
        issue(&mut ledger, NativeAssetId::SunReyCoin, "bob", 12, "b1", 1);
        issue(&mut ledger, NativeAssetId::MoonReyCoin, "alice", 30, "a1", 2);
        lock_for(&mut ledger, "bob", NativeAssetId::SunReyCoin, 10, "lock-bob", 3);
        lock_for(&mut ledger, "alice", NativeAssetId::MoonReyCoin, 25, "lock-alice", 4);
        ledger.register_exchange_authority(EXCHANGE_SETTLEMENT_ISSUER, vec![0x11; 32]).unwrap();
        let crypto = TestCrypto;
        let policy = policy();
        let settle_ctx = SettlementApplyContext {
            height: 5,
            network_id: "net_sunrey_local_dev",
            chain_id: "chn_sunrey_local_dev",
            crypto: &crypto,
            crypto_policy: &policy,
        };
        let payload = dvp_payload(DvpSpec {
            settlement_id: "set-1",
            trade_id: "trd-1",
            seller_lock: "lock-bob",
            buyer_lock: "lock-alice",
            nonce: 1,
            trading_fee: 1,
            network_fee: 1,
        });
        apply_exchange_settlement(&mut ledger, &payload, &settle_ctx).unwrap();
        assert_eq!(ledger.available("alice", NativeAssetId::SunReyCoin), 10);
        assert_eq!(ledger.available("bob", NativeAssetId::MoonReyCoin), 25);
        assert_eq!(ledger.available("fees", NativeAssetId::MoonReyCoin), 1);
        assert_eq!(ledger.available("fees", NativeAssetId::SunReyCoin), 1);
        assert_eq!(
            apply_exchange_settlement(&mut ledger, &payload, &settle_ctx).unwrap_err(),
            AssetError::SettlementReplay
        );
        let mut replay_trade = dvp_payload(DvpSpec {
            settlement_id: "set-2",
            trade_id: "trd-1",
            seller_lock: "lock-bob",
            buyer_lock: "lock-alice",
            nonce: 2,
            trading_fee: 0,
            network_fee: 0,
        });
        replay_trade.legs.truncate(2);
        assert_eq!(
            apply_exchange_settlement(&mut ledger, &replay_trade, &settle_ctx).unwrap_err(),
            AssetError::TradeAlreadySettled
        );
        ledger.reconcile_all().unwrap();
    }

    #[test]
    fn fabricated_wrong_asset_network_and_authority_rejected() {
        let mut ledger = NativeAssetLedger::development();
        issue(&mut ledger, NativeAssetId::SunReyCoin, "bob", 10, "b2", 1);
        issue(&mut ledger, NativeAssetId::MoonReyCoin, "alice", 25, "a2", 2);
        lock_for(&mut ledger, "bob", NativeAssetId::SunReyCoin, 10, "lock-bob-2", 3);
        lock_for(&mut ledger, "alice", NativeAssetId::MoonReyCoin, 25, "lock-alice-2", 4);
        ledger.register_exchange_authority(EXCHANGE_SETTLEMENT_ISSUER, vec![0x11; 32]).unwrap();
        let crypto = TestCrypto;
        let policy = policy();
        let settle_ctx = SettlementApplyContext {
            height: 5,
            network_id: "net_sunrey_local_dev",
            chain_id: "chn_sunrey_local_dev",
            crypto: &crypto,
            crypto_policy: &policy,
        };
        let mut fabricated = dvp_payload(DvpSpec {
            settlement_id: "set-f",
            trade_id: "trd-f",
            seller_lock: "lock-bob-2",
            buyer_lock: "lock-alice-2",
            nonce: 9,
            trading_fee: 0,
            network_fee: 0,
        });
        fabricated.authority.issuer = "alice".to_string();
        fabricated.authority.signature = fabricated.authority.public_key.clone();
        assert_eq!(
            apply_exchange_settlement(&mut ledger, &fabricated, &settle_ctx).unwrap_err(),
            AssetError::WrongAuthority
        );
        let mut wrong_net = dvp_payload(DvpSpec {
            settlement_id: "set-n",
            trade_id: "trd-n",
            seller_lock: "lock-bob-2",
            buyer_lock: "lock-alice-2",
            nonce: 10,
            trading_fee: 0,
            network_fee: 0,
        });
        wrong_net.network_id = "net_other".to_string();
        wrong_net.authority.network_id = "net_other".to_string();
        wrong_net.authority.signature = wrong_net.authority.public_key.clone();
        assert_eq!(
            apply_exchange_settlement(&mut ledger, &wrong_net, &settle_ctx).unwrap_err(),
            AssetError::WrongNetwork
        );
        let mut wrong_asset = dvp_payload(DvpSpec {
            settlement_id: "set-a",
            trade_id: "trd-a",
            seller_lock: "lock-bob-2",
            buyer_lock: "lock-alice-2",
            nonce: 11,
            trading_fee: 0,
            network_fee: 0,
        });
        wrong_asset.legs[0].asset_id = NativeAssetId::MoonReyCoin;
        assert_eq!(
            apply_exchange_settlement(&mut ledger, &wrong_asset, &settle_ctx).unwrap_err(),
            AssetError::WrongAsset
        );
        let mut short = dvp_payload(DvpSpec {
            settlement_id: "set-s",
            trade_id: "trd-s",
            seller_lock: "lock-missing",
            buyer_lock: "lock-alice-2",
            nonce: 12,
            trading_fee: 0,
            network_fee: 0,
        });
        short.reservation_refs = vec!["lock-missing".to_string(), "lock-alice-2".to_string()];
        assert_eq!(
            apply_exchange_settlement(&mut ledger, &short, &settle_ctx).unwrap_err(),
            AssetError::LockNotFound
        );
        assert_eq!(ledger.available("alice", NativeAssetId::SunReyCoin), 0);
        assert_eq!(ledger.available("bob", NativeAssetId::MoonReyCoin), 0);
    }

    #[test]
    fn settlement_round_trip_and_validators_agree() {
        let mut a = NativeAssetLedger::development();
        issue(&mut a, NativeAssetId::SunReyCoin, "bob", 10, "r1", 1);
        issue(&mut a, NativeAssetId::MoonReyCoin, "alice", 25, "r2", 2);
        lock_for(&mut a, "bob", NativeAssetId::SunReyCoin, 10, "lb", 3);
        lock_for(&mut a, "alice", NativeAssetId::MoonReyCoin, 25, "la", 4);
        a.register_exchange_authority(EXCHANGE_SETTLEMENT_ISSUER, vec![0x11; 32]).unwrap();
        let crypto = TestCrypto;
        let policy = policy();
        let settle_ctx = SettlementApplyContext {
            height: 5,
            network_id: "net_sunrey_local_dev",
            chain_id: "chn_sunrey_local_dev",
            crypto: &crypto,
            crypto_policy: &policy,
        };
        apply_exchange_settlement(
            &mut a,
            &dvp_payload(DvpSpec {
                settlement_id: "set-r",
                trade_id: "trd-r",
                seller_lock: "lb",
                buyer_lock: "la",
                nonce: 1,
                trading_fee: 0,
                network_fee: 0,
            }),
            &settle_ctx,
        )
        .unwrap();
        let b = NativeAssetLedger::decode(&a.canonical_bytes()).unwrap();
        assert_eq!(a.canonical_bytes(), b.canonical_bytes());
        assert_eq!(b.available("alice", NativeAssetId::SunReyCoin), 10);
        assert_eq!(b.available("bob", NativeAssetId::MoonReyCoin), 25);
    }
}
