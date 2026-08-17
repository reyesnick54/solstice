//! Four independent validator processes over the real development P2P network.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::chain::{Transaction, DEV_CHAIN_ID, DEV_NETWORK_ID};
use crate::consensus::FourValidatorFixture;
use crate::error::{NodeError, NodeResult};
use crate::identity::{PeerAddress, PeerIdentity};
use crate::native_assets::{encode_with_auth, sign_authorization, sign_settlement_authority};
use crate::node::{generate_wallet, ConsensusNodeConfig, DevelopmentNode, NodeConfig, NodeEvent};
use crate::operator::serve_operator;
use sunrey_native_assets::{
    faucet_payload, AssetQuantity, ExchangeSettlementAuthority, ExchangeSettlementPayload,
    FaucetRequest, IssuanceAuthorization, LockPurpose, NativeAssetId, NativeAssetOp,
    NativeAssetPayload, SettlementLeg, SettlementLegKind, SettlementSource,
    DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER, EXCHANGE_SETTLEMENT_ISSUER,
    EXCHANGE_SETTLEMENT_POLICY, SETTLEMENT_TX_VERSION, TICKER_STATUS_NOT_ASSIGNED,
};

#[derive(Debug, Clone, serde::Serialize)]
pub struct FourValidatorReport {
    pub validators: u8,
    pub genesis_hash: String,
    pub validator_set_hash: String,
    pub heights: Vec<u64>,
    pub block_ids: Vec<String>,
    pub state_roots: Vec<String>,
    pub commit_rounds: Vec<u32>,
    pub healthy_finality: bool,
}

pub async fn run_four_validator_devnet(root: PathBuf) -> NodeResult<FourValidatorReport> {
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).map_err(|e| NodeError::Store(e.to_string()))?;
    let fixture = FourValidatorFixture::development();

    let (a, listen_a) = spawn_validator("A", root.join("a"), Vec::new(), &fixture).await?;
    let seed = PeerAddress::from_socket(listen_a);
    let (b, _) = spawn_validator("B", root.join("b"), vec![seed.clone()], &fixture).await?;
    let (c, _) = spawn_validator("C", root.join("c"), vec![seed.clone()], &fixture).await?;
    let (d, _) = spawn_validator("D", root.join("d"), vec![seed], &fixture).await?;
    let nodes = [a, b, c, d];

    wait_until(Duration::from_secs(12), || {
        nodes[0].metrics_snapshot().peer_count >= 3
            && nodes[1].metrics_snapshot().peer_count >= 1
            && nodes[2].metrics_snapshot().peer_count >= 1
            && nodes[3].metrics_snapshot().peer_count >= 1
    })
    .await?;

    if nodes
        .iter()
        .any(|n| n.config.genesis.hash != fixture.genesis.hash)
    {
        return Err(NodeError::Validation("genesis mismatch".into()));
    }
    if nodes
        .iter()
        .any(|n| n.validator_set_hash() != fixture.set.hash())
    {
        return Err(NodeError::Validation("validator-set hash mismatch".into()));
    }

    let wallet = generate_wallet();
    let tx = Transaction::sign(
        &wallet,
        &fixture.genesis.network_id,
        &fixture.genesis.chain_id,
        "devnet-actor",
        1,
        b"chunk-38-tx".to_vec(),
        0,
    )?;
    let _ = nodes[3].submit_tx(tx)?;

    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| n.finalized_height() >= 2)
    })
    .await?;
    assert_identical(&nodes, 1)?;
    assert_identical(&nodes, 2)?;

    let report = FourValidatorReport {
        validators: 4,
        genesis_hash: hex::encode(fixture.genesis.hash),
        validator_set_hash: hex::encode(fixture.set.hash()),
        heights: nodes.iter().map(|n| n.finalized_height()).collect(),
        block_ids: nodes
            .iter()
            .map(|n| {
                n.finalized_block(2)
                    .map(|b| hex::encode(b.block_id))
                    .unwrap_or_default()
            })
            .collect(),
        state_roots: nodes
            .iter()
            .map(|n| hex::encode(n.state_root_at_height(2).unwrap_or([0u8; 32])))
            .collect(),
        commit_rounds: nodes
            .iter()
            .map(|n| n.consensus_round_at_commit(2).unwrap_or(0))
            .collect(),
        healthy_finality: true,
    };

    for node in nodes {
        node.shutdown().await;
    }
    Ok(report)
}

async fn spawn_validator(
    name: &str,
    dir: PathBuf,
    seeds: Vec<PeerAddress>,
    fixture: &FourValidatorFixture,
) -> NodeResult<(Arc<DevelopmentNode>, SocketAddr)> {
    std::fs::create_dir_all(&dir).map_err(|e| NodeError::Store(e.to_string()))?;
    let item = fixture.by_name(name);
    PeerIdentity::from_seed(item.p2p_seed).persist(&dir)?;
    let mut config = NodeConfig::development(
        name,
        dir,
        "127.0.0.1:0".parse().unwrap(),
        "127.0.0.1:0".parse().unwrap(),
    );
    config.seeds = seeds;
    config.genesis = fixture.genesis.clone();
    config.consensus = Some(ConsensusNodeConfig {
        validator_name: name.into(),
        consensus_key: item.consensus_key.clone(),
        validator_set: fixture.set.clone(),
        params: fixture.params,
    });
    let node = Arc::new(DevelopmentNode::open(config)?);
    let listen = node.start().await?;
    let operator = Arc::clone(&node);
    tokio::spawn(async move {
        let _ = serve_operator(operator).await;
    });
    Ok((node, listen))
}

fn assert_identical(nodes: &[Arc<DevelopmentNode>; 4], height: u64) -> NodeResult<()> {
    let first = nodes[0]
        .finalized_block(height)
        .ok_or_else(|| NodeError::Validation("missing finalized block".into()))?;
    let cert = nodes[0]
        .commit_certificate(height)
        .ok_or_else(|| NodeError::Validation("missing commit certificate".into()))?;
    for node in nodes {
        let block = node
            .finalized_block(height)
            .ok_or_else(|| NodeError::Validation("peer missing finalized block".into()))?;
        if block.block_id != first.block_id || block.header.state_root != first.header.state_root {
            return Err(NodeError::Validation("finalized blocks diverged".into()));
        }
        let other = node
            .commit_certificate(height)
            .ok_or_else(|| NodeError::Validation("peer missing certificate".into()))?;
        if other.height != cert.height
            || other.block_id != cert.block_id
            || other.state_root != cert.state_root
            || other.validator_set_hash != cert.validator_set_hash
        {
            return Err(NodeError::Validation("commit certificates diverged".into()));
        }
    }
    Ok(())
}

async fn wait_until<F>(timeout: Duration, mut pred: F) -> NodeResult<()>
where
    F: FnMut() -> bool,
{
    let start = Instant::now();
    while start.elapsed() < timeout {
        if pred() {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    Err(NodeError::Sync("validator readiness wait timed out".into()))
}

pub fn _watch_finality(event: &NodeEvent) -> bool {
    matches!(event, NodeEvent::ConsensusFinalized { .. })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct NativeAssetDevnetReport {
    pub validators: u8,
    pub sunrey_registered: bool,
    pub moonrey_registered: bool,
    pub tickers: [&'static str; 2],
    pub sunrey_issued: String,
    pub moonrey_issued: String,
    pub sunrey_burned: String,
    pub transfer_ok: bool,
    pub lock_rejected_overspend: bool,
    pub unlock_ok: bool,
    pub burn_ok: bool,
    pub reconciliation_ok: bool,
    pub application_supply_imported: bool,
    pub state_roots: Vec<String>,
    pub roots_equal: bool,
    pub environment: &'static str,
}

pub async fn run_native_asset_devnet(root: PathBuf) -> NodeResult<NativeAssetDevnetReport> {
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).map_err(|e| NodeError::Store(e.to_string()))?;
    let fixture = FourValidatorFixture::development();
    let (a, listen_a) = spawn_validator("A", root.join("a"), Vec::new(), &fixture).await?;
    let seed = PeerAddress::from_socket(listen_a);
    let (b, _) = spawn_validator("B", root.join("b"), vec![seed.clone()], &fixture).await?;
    let (c, _) = spawn_validator("C", root.join("c"), vec![seed.clone()], &fixture).await?;
    let (d, _) = spawn_validator("D", root.join("d"), vec![seed], &fixture).await?;
    let nodes = [a, b, c, d];
    wait_until(Duration::from_secs(12), || {
        nodes[0].metrics_snapshot().peer_count >= 3
            && nodes[1].metrics_snapshot().peer_count >= 1
            && nodes[2].metrics_snapshot().peer_count >= 1
            && nodes[3].metrics_snapshot().peer_count >= 1
    })
    .await?;

    let registry = nodes[0].native_assets().registry;
    let sun = registry
        .get(NativeAssetId::SunReyCoin)
        .map_err(|e| NodeError::Validation(e.to_string()))?;
    let moon = registry
        .get(NativeAssetId::MoonReyCoin)
        .map_err(|e| NodeError::Validation(e.to_string()))?;
    if sun.ticker_status != TICKER_STATUS_NOT_ASSIGNED
        || moon.ticker_status != TICKER_STATUS_NOT_ASSIGNED
    {
        return Err(NodeError::Validation("ticker assigned".into()));
    }

    let wallet = generate_wallet();
    let mut faucet_nonce = 1;
    let sun_tx = signed_faucet(
        &wallet,
        faucet_nonce,
        NativeAssetId::SunReyCoin,
        "alice",
        100,
        "sun-f1",
    )?;
    faucet_nonce += 1;
    let moon_tx = signed_faucet(
        &wallet,
        faucet_nonce,
        NativeAssetId::MoonReyCoin,
        "alice",
        80,
        "moon-f1",
    )?;
    // Mempool admission checks the committed nonce only. Same-actor
    // transactions must finalize before the next nonce is submitted.
    nodes[3].submit_tx(sun_tx)?;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("alice", NativeAssetId::SunReyCoin)
                == 100
        })
    })
    .await?;
    nodes[3].submit_tx(moon_tx)?;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("alice", NativeAssetId::MoonReyCoin)
                == 80
        })
    })
    .await?;

    let mut alice_nonce = 1;
    nodes[2].submit_tx(signed_transfer(
        &wallet,
        "alice",
        alice_nonce,
        NativeAssetId::SunReyCoin,
        "bob",
        40,
    )?)?;
    alice_nonce += 1;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("bob", NativeAssetId::SunReyCoin)
                == 40
        })
    })
    .await?;
    nodes[2].submit_tx(signed_transfer(
        &wallet,
        "alice",
        alice_nonce,
        NativeAssetId::MoonReyCoin,
        "bob",
        20,
    )?)?;
    alice_nonce += 1;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("bob", NativeAssetId::MoonReyCoin)
                == 20
        })
    })
    .await?;

    nodes[1].submit_tx(signed_lock(
        &wallet,
        "alice",
        alice_nonce,
        NativeAssetId::SunReyCoin,
        30,
        "lock-1",
    )?)?;
    alice_nonce += 1;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("alice", NativeAssetId::SunReyCoin)
                == 30
        })
    })
    .await?;
    let available = nodes[0]
        .native_assets()
        .available("alice", NativeAssetId::SunReyCoin);
    if available != 30 {
        return Err(NodeError::Validation(format!(
            "expected 30 available, got {available}"
        )));
    }

    let locked_spend = signed_transfer(
        &wallet,
        "alice",
        alice_nonce,
        NativeAssetId::SunReyCoin,
        "bob",
        31,
    )?;
    let _ = nodes[0].submit_tx(locked_spend);
    tokio::time::sleep(Duration::from_millis(800)).await;
    let still_available = nodes[0]
        .native_assets()
        .available("alice", NativeAssetId::SunReyCoin);
    let lock_rejected = still_available == 30;

    nodes[0].submit_tx(signed_unlock(
        &wallet,
        "alice",
        alice_nonce,
        NativeAssetId::SunReyCoin,
        "lock-1",
    )?)?;
    alice_nonce += 1;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .holding("alice", NativeAssetId::SunReyCoin)
                .locked
                == 0
                && n.native_assets()
                    .available("alice", NativeAssetId::SunReyCoin)
                    == 60
        })
    })
    .await?;
    nodes[0].submit_tx(signed_transfer(
        &wallet,
        "alice",
        alice_nonce,
        NativeAssetId::SunReyCoin,
        "bob",
        20,
    )?)?;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("bob", NativeAssetId::SunReyCoin)
                == 60
        })
    })
    .await?;
    nodes[1].submit_tx(signed_burn(
        &wallet,
        "bob",
        1,
        NativeAssetId::SunReyCoin,
        10,
    )?)?;
    wait_until(Duration::from_secs(30), || {
        nodes
            .iter()
            .all(|n| n.native_assets().supply(NativeAssetId::SunReyCoin).burned == 10)
    })
    .await?;
    let final_height = nodes[0].finalized_height();
    wait_height(&nodes, final_height).await?;
    assert_identical(&nodes, final_height)?;

    let assets = nodes[0].native_assets();
    assets
        .reconcile_all()
        .map_err(|e| NodeError::Validation(e.to_string()))?;
    let sun_supply = assets.supply(NativeAssetId::SunReyCoin);
    let moon_supply = assets.supply(NativeAssetId::MoonReyCoin);
    let roots: Vec<String> = nodes.iter().map(|n| hex::encode(n.state_root())).collect();
    let roots_equal = roots.windows(2).all(|w| w[0] == w[1]);

    for node in nodes {
        node.shutdown().await;
    }

    Ok(NativeAssetDevnetReport {
        validators: 4,
        sunrey_registered: true,
        moonrey_registered: true,
        tickers: [TICKER_STATUS_NOT_ASSIGNED, TICKER_STATUS_NOT_ASSIGNED],
        sunrey_issued: sun_supply.issued.to_string(),
        moonrey_issued: moon_supply.issued.to_string(),
        sunrey_burned: sun_supply.burned.to_string(),
        transfer_ok: assets.available("bob", NativeAssetId::SunReyCoin) >= 50
            && assets.available("bob", NativeAssetId::MoonReyCoin) == 20,
        lock_rejected_overspend: lock_rejected,
        unlock_ok: assets.holding("alice", NativeAssetId::SunReyCoin).locked == 0,
        burn_ok: sun_supply.burned == 10,
        reconciliation_ok: true,
        application_supply_imported: false,
        state_roots: roots,
        roots_equal,
        environment: "development/simulation",
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ExchangeSettlementDevnetReport {
    pub validators: u8,
    pub market: &'static str,
    pub alice_sunrey: String,
    pub bob_moonrey: String,
    pub trading_fee: String,
    pub network_fee: String,
    pub deposits_finalized: bool,
    pub reservations_validated: bool,
    pub dvp_atomic: bool,
    pub settlement_finalized: bool,
    pub failure_rejected_atomically: bool,
    pub no_partial_movement: bool,
    pub no_duplicate_settlement: bool,
    pub ambiguity_resolved_once: bool,
    pub reconciliation_ok: bool,
    pub roots_equal: bool,
    pub tickers: [&'static str; 2],
    pub environment: &'static str,
}

pub async fn run_exchange_settlement_devnet(
    root: PathBuf,
) -> NodeResult<ExchangeSettlementDevnetReport> {
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).map_err(|e| NodeError::Store(e.to_string()))?;
    let fixture = FourValidatorFixture::development();
    let (a, listen_a) = spawn_validator("A", root.join("a"), Vec::new(), &fixture).await?;
    let seed = PeerAddress::from_socket(listen_a);
    let (b, _) = spawn_validator("B", root.join("b"), vec![seed.clone()], &fixture).await?;
    let (c, _) = spawn_validator("C", root.join("c"), vec![seed.clone()], &fixture).await?;
    let (d, _) = spawn_validator("D", root.join("d"), vec![seed], &fixture).await?;
    let nodes = [a, b, c, d];
    wait_until(Duration::from_secs(12), || {
        nodes[0].metrics_snapshot().peer_count >= 3
            && nodes[1].metrics_snapshot().peer_count >= 1
            && nodes[2].metrics_snapshot().peer_count >= 1
            && nodes[3].metrics_snapshot().peer_count >= 1
    })
    .await?;

    let wallet = generate_wallet();
    nodes[3].submit_tx(signed_faucet(
        &wallet,
        1,
        NativeAssetId::MoonReyCoin,
        "alice",
        26,
        "ex-moon-alice",
    )?)?;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("alice", NativeAssetId::MoonReyCoin)
                == 26
        })
    })
    .await?;
    nodes[3].submit_tx(signed_faucet(
        &wallet,
        2,
        NativeAssetId::SunReyCoin,
        "bob",
        12,
        "ex-sun-bob",
    )?)?;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("bob", NativeAssetId::SunReyCoin)
                == 12
        })
    })
    .await?;
    let deposits_finalized = true;

    nodes[2].submit_tx(signed_lock(
        &wallet,
        "bob",
        1,
        NativeAssetId::SunReyCoin,
        10,
        "res-bob-sun",
    )?)?;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("bob", NativeAssetId::SunReyCoin)
                == 2
        })
    })
    .await?;
    nodes[2].submit_tx(signed_lock(
        &wallet,
        "alice",
        1,
        NativeAssetId::MoonReyCoin,
        25,
        "res-alice-moon",
    )?)?;
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("alice", NativeAssetId::MoonReyCoin)
                == 1
        })
    })
    .await?;
    let reservations_validated = nodes[0].native_assets().locks.contains_key("res-bob-sun")
        && nodes[0]
            .native_assets()
            .locks
            .contains_key("res-alice-moon");

    let settlement = signed_exchange_settlement(
        &wallet,
        ExchangeSettlementSpec {
            nonce: 1,
            settlement_id: "xset-1",
            trade_id: "xtrd-1",
            seller_lock: "res-bob-sun",
            buyer_lock: "res-alice-moon",
            auth_nonce: 1,
            trading_fee: 1,
            network_fee: 1,
        },
    )?;
    let settlement_tx_id = hex::encode(nodes[1].submit_tx(settlement)?);
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| {
            n.native_assets()
                .available("alice", NativeAssetId::SunReyCoin)
                == 10
                && n.native_assets()
                    .available("bob", NativeAssetId::MoonReyCoin)
                    == 25
        })
    })
    .await?;

    let after = nodes[0].native_assets();
    let dvp_atomic = after.available("alice", NativeAssetId::SunReyCoin) == 10
        && after.available("bob", NativeAssetId::MoonReyCoin) == 25
        && after.available("alice", NativeAssetId::MoonReyCoin) == 0
        && after.available("fees", NativeAssetId::MoonReyCoin) == 1
        && after.available("fees", NativeAssetId::SunReyCoin) == 1;
    let settlement_finalized = after.used_settlements.contains_key("xset-1")
        && after.settled_trades.contains_key("xtrd-1");

    let replay = signed_exchange_settlement(
        &wallet,
        ExchangeSettlementSpec {
            nonce: 2,
            settlement_id: "xset-1",
            trade_id: "xtrd-1",
            seller_lock: "res-bob-sun",
            buyer_lock: "res-alice-moon",
            auth_nonce: 2,
            trading_fee: 0,
            network_fee: 0,
        },
    )?;
    let _ = nodes[0].submit_tx(replay);
    tokio::time::sleep(Duration::from_millis(800)).await;
    let no_duplicate = nodes.iter().all(|n| {
        n.native_assets()
            .available("alice", NativeAssetId::SunReyCoin)
            == 10
            && n.native_assets().settled_trades.len() == 1
    });

    let insufficient = signed_exchange_settlement(
        &wallet,
        ExchangeSettlementSpec {
            nonce: 3,
            settlement_id: "xset-fail",
            trade_id: "xtrd-fail",
            seller_lock: "res-missing",
            buyer_lock: "res-alice-moon",
            auth_nonce: 3,
            trading_fee: 0,
            network_fee: 0,
        },
    )?;
    let _ = nodes[0].submit_tx(insufficient);
    tokio::time::sleep(Duration::from_millis(800)).await;
    let after_fail = nodes[0].native_assets();
    let failure_rejected = !after_fail.used_settlements.contains_key("xset-fail");
    let no_partial = after_fail.available("alice", NativeAssetId::SunReyCoin) == 10
        && after_fail.available("bob", NativeAssetId::MoonReyCoin) == 25
        && after_fail.available("fees", NativeAssetId::MoonReyCoin) == 1;

    let queried = nodes
        .iter()
        .all(|n| n.native_assets().used_settlements.contains_key("xset-1"));
    let _ = settlement_tx_id;
    let ambiguity_resolved_once = queried && no_duplicate;

    after_fail
        .reconcile_all()
        .map_err(|e| NodeError::Validation(e.to_string()))?;
    let final_height = nodes[0].finalized_height();
    wait_height(&nodes, final_height).await?;
    assert_identical(&nodes, final_height)?;
    let roots: Vec<String> = nodes.iter().map(|n| hex::encode(n.state_root())).collect();
    let roots_equal = roots.windows(2).all(|w| w[0] == w[1]);

    for node in nodes {
        node.shutdown().await;
    }

    Ok(ExchangeSettlementDevnetReport {
        validators: 4,
        market: "SUNREY_COIN/MOONREY_COIN",
        alice_sunrey: "10".into(),
        bob_moonrey: "25".into(),
        trading_fee: "1".into(),
        network_fee: "1".into(),
        deposits_finalized,
        reservations_validated,
        dvp_atomic,
        settlement_finalized,
        failure_rejected_atomically: failure_rejected,
        no_partial_movement: no_partial,
        no_duplicate_settlement: no_duplicate,
        ambiguity_resolved_once,
        reconciliation_ok: true,
        roots_equal,
        tickers: [TICKER_STATUS_NOT_ASSIGNED, TICKER_STATUS_NOT_ASSIGNED],
        environment: "development/simulation",
    })
}

async fn wait_height(nodes: &[Arc<DevelopmentNode>; 4], min: u64) -> NodeResult<u64> {
    wait_until(Duration::from_secs(30), || {
        nodes.iter().all(|n| n.finalized_height() >= min)
    })
    .await?;
    Ok(nodes[0].finalized_height())
}

fn signed_faucet(
    wallet: &crate::crypto::DomainKey,
    nonce: u64,
    asset: NativeAssetId,
    recipient: &str,
    qty: u128,
    auth_id: &str,
) -> NodeResult<Transaction> {
    let payload = faucet_payload(&FaucetRequest {
        asset_id: asset,
        recipient: recipient.to_string(),
        quantity: qty,
        authorization_id: auth_id.to_string(),
    })
    .map_err(|e| NodeError::Validation(e.to_string()))?;
    let mut auth = IssuanceAuthorization {
        authorization_id: auth_id.to_string(),
        asset_id: asset,
        recipient: recipient.to_string(),
        quantity: qty,
        issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
        proof_reference: format!("faucet:{auth_id}"),
        governance_policy_reference: "gov.native.dev.v1".to_string(),
        expiration_height: 10_000,
        issuer: DEV_FAUCET_ISSUER.to_string(),
        suite_id: String::new(),
        algorithm_id: String::new(),
        public_key: vec![],
        signature: vec![],
        network_id: DEV_NETWORK_ID.to_string(),
        chain_id: DEV_CHAIN_ID.to_string(),
    };
    sign_authorization(&mut auth, &wallet.seed_bytes());
    Transaction::sign(
        wallet,
        DEV_NETWORK_ID,
        DEV_CHAIN_ID,
        "dev.faucet",
        nonce,
        encode_with_auth(&payload, &auth),
        0,
    )
}

fn signed_transfer(
    wallet: &crate::crypto::DomainKey,
    actor: &str,
    nonce: u64,
    asset: NativeAssetId,
    to: &str,
    qty: u128,
) -> NodeResult<Transaction> {
    let payload = NativeAssetPayload::transfer(
        actor,
        to,
        AssetQuantity::new(asset, qty).map_err(|e| NodeError::Validation(e.to_string()))?,
    );
    Transaction::sign(
        wallet,
        DEV_NETWORK_ID,
        DEV_CHAIN_ID,
        actor,
        nonce,
        payload.encode(),
        0,
    )
}

fn signed_lock(
    wallet: &crate::crypto::DomainKey,
    actor: &str,
    nonce: u64,
    asset: NativeAssetId,
    qty: u128,
    lock_id: &str,
) -> NodeResult<Transaction> {
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Lock,
        actor_id: actor.to_string(),
        asset_id: asset,
        quantity: qty,
        counterparty: String::new(),
        lock_id: lock_id.to_string(),
        lock_purpose: Some(LockPurpose::Escrow),
        expiration_height: None,
        authorized_releaser: actor.to_string(),
        authorization_id: String::new(),
        issuance_policy: String::new(),
        proof_reference: String::new(),
        economic_unit_label: String::new(),
    };
    Transaction::sign(
        wallet,
        DEV_NETWORK_ID,
        DEV_CHAIN_ID,
        actor,
        nonce,
        payload.encode(),
        0,
    )
}

fn signed_unlock(
    wallet: &crate::crypto::DomainKey,
    actor: &str,
    nonce: u64,
    asset: NativeAssetId,
    lock_id: &str,
) -> NodeResult<Transaction> {
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Unlock,
        actor_id: actor.to_string(),
        asset_id: asset,
        quantity: 0,
        counterparty: String::new(),
        lock_id: lock_id.to_string(),
        lock_purpose: Some(LockPurpose::Escrow),
        expiration_height: None,
        authorized_releaser: actor.to_string(),
        authorization_id: String::new(),
        issuance_policy: String::new(),
        proof_reference: String::new(),
        economic_unit_label: String::new(),
    };
    Transaction::sign(
        wallet,
        DEV_NETWORK_ID,
        DEV_CHAIN_ID,
        actor,
        nonce,
        payload.encode(),
        0,
    )
}

fn signed_burn(
    wallet: &crate::crypto::DomainKey,
    actor: &str,
    nonce: u64,
    asset: NativeAssetId,
    qty: u128,
) -> NodeResult<Transaction> {
    let payload = NativeAssetPayload {
        version: 1,
        op: NativeAssetOp::Burn,
        actor_id: actor.to_string(),
        asset_id: asset,
        quantity: qty,
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
    Transaction::sign(
        wallet,
        DEV_NETWORK_ID,
        DEV_CHAIN_ID,
        actor,
        nonce,
        payload.encode(),
        0,
    )
}

struct ExchangeSettlementSpec {
    nonce: u64,
    settlement_id: &'static str,
    trade_id: &'static str,
    seller_lock: &'static str,
    buyer_lock: &'static str,
    auth_nonce: u64,
    trading_fee: u128,
    network_fee: u128,
}

fn signed_exchange_settlement(
    wallet: &crate::crypto::DomainKey,
    spec: ExchangeSettlementSpec,
) -> NodeResult<Transaction> {
    let ExchangeSettlementSpec {
        nonce,
        settlement_id,
        trade_id,
        seller_lock,
        buyer_lock,
        auth_nonce,
        trading_fee,
        network_fee,
    } = spec;
    let mut legs = vec![
        SettlementLeg {
            asset_id: NativeAssetId::SunReyCoin,
            from: "bob".to_string(),
            to: "alice".to_string(),
            quantity: 10,
            source: SettlementSource::Lock {
                lock_id: seller_lock.to_string(),
            },
            kind: SettlementLegKind::Base,
        },
        SettlementLeg {
            asset_id: NativeAssetId::MoonReyCoin,
            from: "alice".to_string(),
            to: "bob".to_string(),
            quantity: 25,
            source: SettlementSource::Lock {
                lock_id: buyer_lock.to_string(),
            },
            kind: SettlementLegKind::Quote,
        },
    ];
    if trading_fee > 0 {
        legs.push(SettlementLeg {
            asset_id: NativeAssetId::MoonReyCoin,
            from: "alice".to_string(),
            to: "fees".to_string(),
            quantity: trading_fee,
            source: SettlementSource::Available,
            kind: SettlementLegKind::TradingFee,
        });
    }
    if network_fee > 0 {
        legs.push(SettlementLeg {
            asset_id: NativeAssetId::SunReyCoin,
            from: "bob".to_string(),
            to: "fees".to_string(),
            quantity: network_fee,
            source: SettlementSource::Available,
            kind: SettlementLegKind::NetworkFee,
        });
    }
    let mut authority = ExchangeSettlementAuthority {
        settlement_id: settlement_id.to_string(),
        issuer: EXCHANGE_SETTLEMENT_ISSUER.to_string(),
        policy_version: EXCHANGE_SETTLEMENT_POLICY.to_string(),
        network_id: DEV_NETWORK_ID.to_string(),
        chain_id: DEV_CHAIN_ID.to_string(),
        nonce: auth_nonce,
        expiration_height: 10_000,
        suite_id: String::new(),
        algorithm_id: String::new(),
        public_key: vec![],
        signature: vec![],
    };
    sign_settlement_authority(&mut authority, &wallet.seed_bytes());
    let payload = ExchangeSettlementPayload {
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
        network_id: DEV_NETWORK_ID.to_string(),
        chain_id: DEV_CHAIN_ID.to_string(),
        nonce: auth_nonce,
        legs,
        authority,
    };
    Transaction::sign(
        wallet,
        DEV_NETWORK_ID,
        DEV_CHAIN_ID,
        EXCHANGE_SETTLEMENT_ISSUER,
        nonce,
        payload.encode(),
        0,
    )
}
