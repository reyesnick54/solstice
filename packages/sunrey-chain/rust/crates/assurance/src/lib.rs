//! Chunk 56 assurance helpers for the SunRey Rust crates.
//!
//! This crate is test infrastructure. It is not a second ledger, consensus
//! engine, or formal-verification product.

use sha2::{Digest, Sha256};
use sunrey_consensus::{
    four_validator_set, BlockId, ConsensusStep, Height, Round, SignerSafetyStore, Vote, VoteSet,
    VoteType,
};
use sunrey_fees::{FeeSchedule, ProtocolOp, ResourceUsage};
use sunrey_interop::InteropAssetLedger;
use sunrey_native_assets::authority::ECONOMIC_UNIT_LABEL_DEVELOPMENT;
use sunrey_native_assets::faucet::FAUCET_ACTOR;
use sunrey_native_assets::{
    apply_native_asset, ApplyContext, AssetCrypto, AssetError, AssetQuantity, CryptoClass,
    CryptoPolicy, IssuanceAuthorization, NativeAssetId, NativeAssetLedger, NativeAssetOp,
    NativeAssetPayload, DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER,
};
use sunrey_oracle::integer_median;
use sunrey_productive::{
    contribution_fingerprint, evaluate_formula, mul_div, FingerprintInput, RoundingMode,
};
use sunrey_protocol::{
    decode_evidence_anchor_payload, decode_system_payload, BlockHeader, GenesisV1,
    SignedTransaction, UnsignedTransaction,
};
use sunrey_wallet::{authorize, parse_address, AccountPolicy, AuthPolicy, PresentedSignature};

pub const ASSURANCE_SEED: u64 = 56;

pub struct TestCrypto;

impl AssetCrypto for TestCrypto {
    fn suite_id(&self) -> &str {
        "TEST_SUITE"
    }
    fn algorithm_id(&self) -> &str {
        "TEST_ALG"
    }
    fn crypto_class(&self) -> CryptoClass {
        CryptoClass::Classical
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

pub fn decode_protocol_bytes(bytes: &[u8]) {
    let _ = UnsignedTransaction::decode(bytes);
    let _ = SignedTransaction::decode(bytes);
    let _ = BlockHeader::decode(bytes);
    let _ = GenesisV1::decode(bytes);
    let _ = decode_system_payload(bytes);
    let _ = decode_evidence_anchor_payload(bytes);
}

pub fn development_fee(encoded_bytes: u128, signature_count: u128) -> Result<u128, String> {
    let usage = ResourceUsage {
        compute: 100,
        state_read: 2,
        state_write: 2,
        tx_bytes: encoded_bytes,
        sig_verify: signature_count,
        crypto_proof: 0,
    };
    let _ = ProtocolOp::NativeTransfer;
    FeeSchedule::development().calculate(usage).map_err(|err| err.to_string())
}

pub fn rust_mul_div(value: u128, numerator: u128, denominator: u128, rounding: &str) -> u128 {
    let mode = match rounding {
        "CEIL" => RoundingMode::Ceil,
        "ROUND_HALF_EVEN" => RoundingMode::RoundHalfEven,
        _ => RoundingMode::Floor,
    };
    mul_div(value, numerator, denominator, mode)
}

pub fn rust_formula(
    eligible: u128,
    category: u128,
    claim: u128,
    quality: u128,
    rounding: &str,
    maximum: u128,
) -> (String, String) {
    let mode = match rounding {
        "CEIL" => RoundingMode::Ceil,
        "ROUND_HALF_EVEN" => RoundingMode::RoundHalfEven,
        _ => RoundingMode::Floor,
    };
    let result = evaluate_formula(eligible, category, claim, quality, mode, maximum);
    (result.uncapped_quantity, result.moonrey_quantity)
}

#[allow(clippy::too_many_arguments)]
pub fn rust_fingerprint(
    object_id: &str,
    epoch: u64,
    valid_from: u64,
    valid_until: u64,
    claim_type: &str,
    category: &str,
    normalized: u128,
    base_unit: &str,
    facts: &[&str],
    upstream: &[&str],
) -> String {
    contribution_fingerprint(FingerprintInput {
        object_id,
        epoch,
        valid_from,
        valid_until,
        claim_type,
        category,
        normalized,
        base_unit,
        oracle_fact_ids: facts,
        upstream,
    })
}

pub fn rust_median(values: &[u64]) -> u64 {
    let mut ordered = values.to_vec();
    ordered.sort_unstable();
    integer_median(&ordered)
}

pub fn signed_auth(
    id: &str,
    asset: NativeAssetId,
    recipient: &str,
    qty: u128,
) -> IssuanceAuthorization {
    IssuanceAuthorization {
        authorization_id: id.to_string(),
        asset_id: asset,
        recipient: recipient.to_string(),
        quantity: qty,
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
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
    }
}

pub fn issue_dev(
    ledger: &mut NativeAssetLedger,
    asset: NativeAssetId,
    recipient: &str,
    qty: u128,
    auth_id: &str,
    height: u64,
) -> Result<(), AssetError> {
    let crypto = TestCrypto;
    let policy = CryptoPolicy::development_classical("TEST_SUITE", "TEST_ALG");
    let auth = signed_auth(auth_id, asset, recipient, qty);
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
    let ctx = ApplyContext {
        height,
        network_id: "net_sunrey_local_dev",
        chain_id: "chn_sunrey_local_dev",
        environment: "simulation",
        production_network_enabled: false,
        protocol_version: 1,
        crypto: &crypto,
        crypto_policy: &policy,
        authorization: Some(&auth),
    };
    apply_native_asset(ledger, &payload, &ctx)
}

pub fn apply_transfer(
    ledger: &mut NativeAssetLedger,
    from: &str,
    to: &str,
    asset: NativeAssetId,
    qty: u128,
    height: u64,
) -> Result<(), AssetError> {
    let crypto = TestCrypto;
    let policy = CryptoPolicy::development_classical("TEST_SUITE", "TEST_ALG");
    let payload = NativeAssetPayload::transfer(from, to, AssetQuantity::new(asset, qty)?);
    let ctx = ApplyContext {
        height,
        network_id: "net_sunrey_local_dev",
        chain_id: "chn_sunrey_local_dev",
        environment: "simulation",
        production_network_enabled: false,
        protocol_version: 1,
        crypto: &crypto,
        crypto_policy: &policy,
        authorization: None,
    };
    apply_native_asset(ledger, &payload, &ctx)
}

pub fn economic_campaign(seed: u64, ops: usize) -> Result<String, String> {
    let mut ledger = NativeAssetLedger::development();
    issue_dev(&mut ledger, NativeAssetId::SunReyCoin, "alice", 50_000, "auth-sun", 1)
        .map_err(|err| err.to_string())?;
    issue_dev(&mut ledger, NativeAssetId::MoonReyCoin, "bob", 50_000, "auth-moon", 2)
        .map_err(|err| err.to_string())?;
    let mut state = seed;
    for i in 0..ops {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let qty = u128::from((state % 40) + 1);
        let asset =
            if state % 2 == 0 { NativeAssetId::SunReyCoin } else { NativeAssetId::MoonReyCoin };
        let from = if asset == NativeAssetId::SunReyCoin { "alice" } else { "bob" };
        let to = if from == "alice" { "carol" } else { "dave" };
        match state % 5 {
            0 => {
                let _ = apply_transfer(&mut ledger, from, to, asset, qty, 3 + i as u64);
            }
            1 => {
                let payload = NativeAssetPayload {
                    version: 1,
                    op: NativeAssetOp::Lock,
                    actor_id: from.to_string(),
                    asset_id: asset,
                    quantity: qty,
                    counterparty: String::new(),
                    lock_id: format!("lock-{i}"),
                    lock_purpose: None,
                    expiration_height: None,
                    authorized_releaser: from.to_string(),
                    authorization_id: String::new(),
                    issuance_policy: String::new(),
                    proof_reference: String::new(),
                    economic_unit_label: ECONOMIC_UNIT_LABEL_DEVELOPMENT.to_string(),
                };
                let crypto = TestCrypto;
                let policy = CryptoPolicy::development_classical("TEST_SUITE", "TEST_ALG");
                let ctx = ApplyContext {
                    height: 3 + i as u64,
                    network_id: "net_sunrey_local_dev",
                    chain_id: "chn_sunrey_local_dev",
                    environment: "simulation",
                    production_network_enabled: false,
                    protocol_version: 1,
                    crypto: &crypto,
                    crypto_policy: &policy,
                    authorization: None,
                };
                let _ = apply_native_asset(&mut ledger, &payload, &ctx);
            }
            2 => {
                let payload = NativeAssetPayload {
                    version: 1,
                    op: NativeAssetOp::Burn,
                    actor_id: from.to_string(),
                    asset_id: asset,
                    quantity: qty.min(5u128),
                    counterparty: String::new(),
                    lock_id: String::new(),
                    lock_purpose: None,
                    expiration_height: None,
                    authorized_releaser: String::new(),
                    authorization_id: String::new(),
                    issuance_policy: String::new(),
                    proof_reference: String::new(),
                    economic_unit_label: ECONOMIC_UNIT_LABEL_DEVELOPMENT.to_string(),
                };
                let crypto = TestCrypto;
                let policy = CryptoPolicy::development_classical("TEST_SUITE", "TEST_ALG");
                let ctx = ApplyContext {
                    height: 3 + i as u64,
                    network_id: "net_sunrey_local_dev",
                    chain_id: "chn_sunrey_local_dev",
                    environment: "simulation",
                    production_network_enabled: false,
                    protocol_version: 1,
                    crypto: &crypto,
                    crypto_policy: &policy,
                    authorization: None,
                };
                let _ = apply_native_asset(&mut ledger, &payload, &ctx);
            }
            _ => {}
        }
        ledger.reconcile_all().map_err(|err| err.to_string())?;
    }
    let mut hasher = Sha256::new();
    hasher.update(ledger.canonical_bytes());
    Ok(hex::encode(hasher.finalize()))
}

pub fn consensus_vote_properties() -> Result<(), String> {
    let set = four_validator_set().map_err(|err| err.to_string())?;
    let mut votes = VoteSet::new(VoteType::Precommit, Height::new(1), Round::new(0));
    for (index, validator) in set.validators.iter().enumerate() {
        let vote = Vote {
            vote_type: VoteType::Precommit,
            network_id: "net_sunrey_simulation".into(),
            chain_id: "chn_sunrey_simulation".into(),
            protocol_version: "1".into(),
            height: Height::new(1),
            round: Round::new(0),
            block_id: BlockId([1u8; 32]),
            validator_id: validator.validator_id.clone(),
            validator_set_version: set.version,
            signature: vec![index as u8; 64],
        };
        let first = votes.add(vote.clone(), &set).map_err(|err| err.to_string())?;
        if first.is_some() {
            return Err("first vote produced evidence".into());
        }
        let dup = votes.add(vote, &set).map_err(|err| err.to_string())?;
        if dup.is_some() {
            return Err("duplicate identical vote counted as evidence".into());
        }
    }
    if !votes.has_two_thirds_for(BlockId([1u8; 32]), &set).map_err(|err| err.to_string())? {
        return Err("4/4 precommits did not finalize".into());
    }
    if votes.has_two_thirds_for(BlockId::NIL, &set).map_err(|err| err.to_string())? {
        return Err("NIL finalized".into());
    }
    Ok(())
}

pub fn signer_safety_sequence(steps: usize) -> Result<u32, String> {
    let mut store = SignerSafetyStore::in_memory();
    let mut conflicts = 0u32;
    let mut height = 1u64;
    let mut round = 0u32;
    for i in 0..steps {
        if i % 6 == 0 {
            height += 1;
            round = 0;
        } else if i % 4 == 0 {
            round += 1;
        }
        let block = if i % 7 == 0 { BlockId([2u8; 32]) } else { BlockId([1u8; 32]) };
        if store
            .authorize(Height::new(height), Round::new(round), ConsensusStep::Precommit, block)
            .is_err()
        {
            conflicts += 1;
        }
    }
    Ok(conflicts)
}

pub fn wallet_auth_threshold(
    threshold: u32,
    presented: u32,
    duplicate: bool,
) -> Result<(), String> {
    let policy = AccountPolicy {
        kind: AuthPolicy::MOfN,
        threshold,
        authorized_key_ids: vec!["a".into(), "b".into(), "c".into(), "d".into(), "e".into()],
    };
    let mut sigs = Vec::new();
    for i in 0..presented {
        sigs.push(PresentedSignature {
            key_id: policy.authorized_key_ids[i as usize].clone(),
            authorized: true,
        });
    }
    if duplicate && !sigs.is_empty() {
        sigs.push(sigs[0].clone());
    }
    match authorize(&policy, &sigs) {
        Ok(()) if presented >= threshold && !duplicate => Ok(()),
        Err(_) if presented < threshold || duplicate => Ok(()),
        other => Err(format!("unexpected auth result {other:?}")),
    }
}

pub fn interop_supply_ok() -> Result<(), String> {
    let mut ledger = InteropAssetLedger::development(1_000);
    ledger.escrow(25).map_err(|err| err.to_string())?;
    ledger.represent_remote(25).map_err(|err| err.to_string())?;
    ledger.invariant().map_err(|err| err.to_string())
}

pub fn parse_dev_address(text: &str) -> Result<String, String> {
    parse_address(text, Some("net_sunrey_simulation"))
        .map(|addr| addr.text)
        .map_err(|err| err.to_string())
}
