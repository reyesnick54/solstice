use std::fs;
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, Instant};

use clap::{Parser, Subcommand};
use sunrey_consensus::{
    development_secret, four_validator_set, ConsensusEngine, ConsensusParams, EngineConfig,
    EnginePaths, FourValidatorHarness, MemoryApp,
};
use sunrey_crypto::{development_fixture_secret, CryptoSuite, DevEd25519Sha256Suite};
use sunrey_crypto::{development_fixture_secret, DevEd25519Sha256Suite};
use sunrey_execution::encode_issue_bytes;
use sunrey_governance::VoteChoice;
use sunrey_native_assets::{
    faucet_notice, AssetQuantity, IssuanceAuthorization, NativeAssetId, NativeAssetOp,
    NativeAssetPayload, DEVELOPMENT_FAUCET_POLICY, DEV_FAUCET_ISSUER,
};
use sunrey_node::{LocalNode, DEV_BLOCK_PRODUCER, NODE_ROLE};
use sunrey_oracle::{
    development_compute_feed, development_energy_feed, seed_secret, sign_observation,
    snapshot_hash, FactType, OracleObservation, OracleProviderRecord, OracleType, ProviderStatus,
    UnitCode,
};
use sunrey_protocol::{
    encode_evidence_anchor_payload, encode_system_payload, hash_to_hex, transaction_id,
    EvidenceAnchorPayload, SystemPayload, TransactionFamily, UnsignedTransaction,
    LOCAL_DEV_CHAIN_ID, LOCAL_DEV_NETWORK_ID, SCHEMA_VERSION, SRCB_CODEC_ID,
};
use sunrey_rpc::{http_get, http_post, RpcServer};
use tracing::info;

#[derive(Parser)]
#[command(name = "sunrey-node", about = "SunRey local development blockchain node (simulation)")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Init {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Run {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, default_value = "127.0.0.1:18432")]
        listen: String,
        #[arg(long)]
        interval_ms: Option<u64>,
    },
    Status {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Submit {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        hex: Option<String>,
        #[arg(long)]
        file: Option<PathBuf>,
        #[arg(long)]
        demo: bool,
    },
    ProduceBlock {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Block {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        height: Option<u64>,
        #[arg(long)]
        id: Option<String>,
    },
    Tx {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: String,
    },
    Verify {
        #[arg(long)]
        data_dir: PathBuf,
    },
    EncodeFixture {
        #[arg(long, default_value = "system-note")]
        name: String,
    },
    Consensus {
        #[command(subcommand)]
        command: ConsensusCommand,
    },
    Validator {
        #[command(subcommand)]
        command: sunrey_validators::ValidatorCommand,
    },
    Governance {
        #[command(subcommand)]
        command: GovernanceCommand,
    },
    Protocol {
        #[command(subcommand)]
        command: ProtocolCommand,
    },
    Productive {
        #[command(subcommand)]
        command: ProductiveCommand,
    },
    Moonrey {
        #[command(subcommand)]
        command: MoonreyCommand,
    Oracle {
        #[command(subcommand)]
        command: OracleCommand,
    Asset {
        #[command(subcommand)]
        command: AssetCommand,
    },
    Fees {
        #[command(subcommand)]
        command: FeesCommand,
    },
}

#[derive(Subcommand)]
enum GovernanceCommand {
    Propose {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: String,
        #[arg(long)]
        kind: String,
        #[arg(long)]
        activation_height: u64,
        #[arg(long)]
        max_transactions: Option<u32>,
        #[arg(long)]
        max_block_bytes: Option<u32>,
    },
    Show {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: Option<String>,
    },
    Vote {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: String,
        #[arg(long)]
        voter: String,
        #[arg(long)]
        choice: String,
    },
    Schedule {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: String,
    },
    Readiness {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: Option<String>,
    },
    Cancel {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: String,
        #[arg(long)]
        actor: String,
    },
    History {
        #[arg(long)]
        data_dir: PathBuf,
    },
}

#[derive(Subcommand)]
enum ProtocolCommand {
    Version {
        #[arg(long)]
        data_dir: PathBuf,
    },
}

#[derive(Subcommand)]
enum ProductiveCommand {
    Object {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: Option<String>,
    },
    Claim {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Verify {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: Option<String>,
    },
    Contribution {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: Option<String>,
    },
    Lineage {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: String,
    },
    Graph {
enum OracleCommand {
    Providers {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Feeds {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Observation {
        #[arg(long)]
        data_dir: PathBuf,
        id: String,
    },
    Fact {
        #[arg(long)]
        data_dir: PathBuf,
        id: String,
    },
    Facts {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        feed: Option<String>,
    },
    Disputes {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Quality {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Demo {
enum AssetCommand {
    List {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Show {
        #[arg(long)]
        data_dir: PathBuf,
        asset: String,
    },
    Supply {
        #[arg(long)]
        data_dir: PathBuf,
        asset: String,
    },
    Holdings {
        #[arg(long)]
        data_dir: PathBuf,
        actor: String,
    },
    Locks {
        #[arg(long)]
        data_dir: PathBuf,
        actor: String,
    },
    Transfer {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        #[arg(long)]
        asset: String,
        #[arg(long)]
        quantity: String,
    },
    Faucet {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        asset: String,
        #[arg(long)]
        recipient: String,
        #[arg(long)]
        quantity: String,
        #[arg(long)]
        auth_id: String,
    },
    Reconciliation {
        #[arg(long)]
        data_dir: PathBuf,
    },
}

#[derive(Subcommand)]
enum MoonreyCommand {
    Policy {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Issuance {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long)]
        id: Option<String>,
    },
    Attribution {
enum FeesCommand {
    Schedule {
        #[arg(long)]
        data_dir: PathBuf,
    },
    Estimate {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, default_value_t = 240)]
        bytes: u128,
        #[arg(long, default_value_t = 1)]
        signatures: u128,
    },
    Receipt {
        #[arg(long)]
        data_dir: PathBuf,
        tx: String,
    },
    Resources {
        #[arg(long)]
        data_dir: PathBuf,
        tx: String,
    },
    Rewards {
        #[arg(long)]
        data_dir: PathBuf,
        validator: String,
    },
    Policy {
        #[arg(long)]
        data_dir: PathBuf,
    },
}

#[derive(Subcommand)]
enum ConsensusCommand {
    Status {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, default_value = "val_a")]
        validator: String,
    },
    Validators {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, default_value = "val_a")]
        validator: String,
    },
    Params {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, default_value = "val_a")]
        validator: String,
    },
    Commit {
        #[arg(long)]
        data_dir: PathBuf,
        height: u64,
        #[arg(long, default_value = "val_a")]
        validator: String,
    },
    WalStatus {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, default_value = "val_a")]
        validator: String,
    },
    Harness,
    Validator {
        #[command(subcommand)]
        command: sunrey_validators::ValidatorCommand,
    },
}

fn main() {
    tracing_subscriber::fmt().json().with_writer(std::io::stderr).with_env_filter("info").init();
    let cli = Cli::parse();
    if let Err(err) = run(cli) {
        eprintln!("error: {}", err);
        std::process::exit(1);
    }
}

fn run(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
    match cli.command {
        Command::Init { data_dir } => {
            let node = LocalNode::init(&data_dir)?;
            println!("environment=simulation");
            println!("role={NODE_ROLE}");
            println!("producer={DEV_BLOCK_PRODUCER}");
            println!("network_id={LOCAL_DEV_NETWORK_ID}");
            println!("chain_id={LOCAL_DEV_CHAIN_ID}");
            println!("genesis_hash={}", hash_to_hex(&node.genesis_hash));
            println!("app_hash={}", node.status().app_hash);
        }
        Command::Run { data_dir, listen, interval_ms } => {
            let node = if data_dir.join("genesis.bin").exists() {
                LocalNode::open(&data_dir)?
            } else {
                LocalNode::init(&data_dir)?
            };
            info!(event = "node_startup", listen = %listen, "local development node starting");
            if let Some(interval) = interval_ms {
                warn_interval(interval);
                let data_dir = data_dir.clone();
                thread::spawn(move || loop {
                    thread::sleep(Duration::from_millis(interval));
                    if let Ok(mut producer) = LocalNode::open(&data_dir) {
                        let _ = producer.produce_block();
                    }
                });
            }
            let server = RpcServer::bind(&listen, node)?;
            println!("environment=simulation listen={}", server.local_addr());
            server.serve()?;
        }
        Command::Status { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.status())?);
        }
        Command::Submit { data_dir, hex, file, demo } => {
            let mut node = LocalNode::open(&data_dir)?;
            let bytes = if demo {
                demo_system_tx(&node)?
            } else if let Some(hex) = hex {
                sunrey_protocol::hex_decode(&hex)?
            } else if let Some(file) = file {
                fs::read(file)?
            } else {
                return Err("submit requires --hex, --file, or --demo".into());
            };
            let tx_id = node.submit_bytes(&bytes)?;
            println!("tx_id={tx_id}");
        }
        Command::ProduceBlock { data_dir } => {
            let mut node = LocalNode::open(&data_dir)?;
            let result = node.produce_block()?;
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
        Command::Block { data_dir, height, id } => {
            let node = LocalNode::open(&data_dir)?;
            let stored = if let Some(height) = height {
                node.store.load_block(height)?
            } else if let Some(id) = id {
                node.store.load_block_by_id(&id)?
            } else {
                node.store.load_block(node.store.meta.height)?
            };
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "height": stored.header.height,
                    "parent_block_id": hash_to_hex(&stored.header.parent_block_id),
                    "transaction_root": hash_to_hex(&stored.header.transaction_root),
                    "app_hash": hash_to_hex(&stored.header.app_hash),
                    "proposer": stored.header.proposer,
                    "tx_count": stored.transactions.len(),
                }))?
            );
        }
        Command::Tx { data_dir, id } => {
            let node = LocalNode::open(&data_dir)?;
            let (height, tx, block_id) = node.lookup_tx(&id)?;
            println!(
                "tx_id={} height={height} block_id={block_id} family={}",
                hash_to_hex(&transaction_id(&node.suite, &tx.unsigned)),
                tx.unsigned.family.as_str()
            );
        }
        Command::Verify { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            node.verify_chain()?;
            println!(
                "verify=ok height={} app_hash={}",
                node.store.meta.height, node.store.meta.app_hash
            );
        }
        Command::Consensus { command } => run_consensus(command)?,
        Command::Validator { command } => {
            println!("{}", sunrey_validators::run_validator_command(command)?);
        }
        Command::Governance { command } => return run_governance(command),
        Command::Protocol { command } => return run_protocol(command),
        Command::Productive { command } => return run_productive(command),
        Command::Moonrey { command } => return run_moonrey(command),
        Command::Oracle { command } => return run_oracle(command),
        Command::Asset { command } => return run_asset(command),
        Command::Fees { command } => return run_fees(command),
        Command::EncodeFixture { name } => {
            let node = LocalNode::init(std::env::temp_dir().join(format!("sunrey-encode-{name}")))?;
            let bytes = match name.as_str() {
                "system-note" => demo_system_tx(&node)?,
                "evidence-anchor" => demo_evidence_tx(&node)?,
                _ => return Err("unknown fixture".into()),
            };
            println!("{}", sunrey_protocol::hex_encode(&bytes));
        }
    }
    Ok(())
}

fn run_governance(command: GovernanceCommand) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        GovernanceCommand::Propose {
            data_dir,
            id,
            kind,
            activation_height,
            max_transactions,
            max_block_bytes,
        } => {
            let mut node = LocalNode::open(&data_dir)?;
            let _ = sunrey_governance::UpgradeKind::parse(&kind)?;
            let mut params = node.governance.params.clone();
            if let Some(value) = max_transactions {
                params.max_transactions = value;
            }
            if let Some(value) = max_block_bytes {
                params.max_block_bytes = value;
            }
            let plan = node.governance.draft_parameter_change(&id, activation_height, params)?;
            node.governance.propose(plan, "gov_operator_1")?;
            node.governance.validate(&id)?;
            node.governance.persist(&data_dir)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "upgrade_id": id,
                    "status": node.governance.plans[&id].status.as_str(),
                    "activation_height": activation_height,
                    "kind": kind,
                }))?
            );
        }
        GovernanceCommand::Show { data_dir, id } => {
            let node = LocalNode::open(&data_dir)?;
            if let Some(id) = id {
                let plan = node.governance.plans.get(&id).ok_or("unknown upgrade")?;
                println!("{}", serde_json::to_string_pretty(plan)?);
            } else {
                println!("{}", serde_json::to_string_pretty(&node.governance.metrics_json())?);
            }
        }
        GovernanceCommand::Vote { data_dir, id, voter, choice } => {
            let mut node = LocalNode::open(&data_dir)?;
            let parsed = match choice.as_str() {
                "APPROVE" => VoteChoice::Approve,
                "REJECT" => VoteChoice::Reject,
                _ => return Err("choice must be APPROVE or REJECT".into()),
            };
            node.governance.vote(&id, &voter, parsed)?;
            node.governance.persist(&data_dir)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "upgrade_id": id,
                    "voter": voter,
                    "choice": choice,
                    "approve_power": node.governance.approve_power(&id),
                    "required_power": node.governance.policy.required_power,
                    "status": node.governance.plans[&id].status.as_str(),
                }))?
            );
        }
        GovernanceCommand::Schedule { data_dir, id } => {
            let mut node = LocalNode::open(&data_dir)?;
            node.governance.schedule(&id, "gov_operator_1")?;
            node.governance.persist(&data_dir)?;
            println!("scheduled {} at height {}", id, node.governance.plans[&id].activation_height);
        }
        GovernanceCommand::Readiness { data_dir, id } => {
            let node = LocalNode::open(&data_dir)?;
            let id = match id.or_else(|| node.governance.pending().map(|p| p.upgrade_id.clone())) {
                Some(id) => id,
                None => {
                    println!("{{\"upgrade_readiness\":\"NONE\"}}");
                    return Ok(());
                }
            };
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "upgrade_id": id,
                    "upgrade_readiness": node.governance.readiness(&id)?.as_str(),
                    "metrics": node.governance.metrics_json(),
                }))?
            );
        }
        GovernanceCommand::Cancel { data_dir, id, actor } => {
            let mut node = LocalNode::open(&data_dir)?;
            node.governance.cancel(&id, &actor)?;
            node.governance.persist(&data_dir)?;
            println!("cancelled {id}");
        }
        GovernanceCommand::History { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.governance.audit)?);
        }
    }
    Ok(())
}

fn run_oracle(command: OracleCommand) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        OracleCommand::Providers { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.oracle.providers)?);
        }
        OracleCommand::Feeds { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.oracle.feeds)?);
        }
        OracleCommand::Observation { data_dir, id } => {
            let node = LocalNode::open(&data_dir)?;
            let row = node.oracle.observations.get(&id).ok_or("observation not found")?;
            println!("{}", serde_json::to_string_pretty(row)?);
        }
        OracleCommand::Fact { data_dir, id } => {
            let node = LocalNode::open(&data_dir)?;
            let row = node.oracle.facts.get(&id).ok_or("fact not found")?;
            println!("{}", serde_json::to_string_pretty(row)?);
        }
        OracleCommand::Facts { data_dir, feed } => {
            let node = LocalNode::open(&data_dir)?;
            let rows: Vec<_> = node
                .oracle
                .facts
                .values()
                .filter(|fact| feed.as_ref().map(|id| fact.feed_id == *id).unwrap_or(true))
                .collect();
            println!("{}", serde_json::to_string_pretty(&rows)?);
        }
        OracleCommand::Disputes { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.oracle.disputes)?);
        }
        OracleCommand::Quality { data_dir } => {
            let mut node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.oracle.quality_report())?);
        }
        OracleCommand::Demo { data_dir } => {
            let mut node = if data_dir.join("genesis.bin").exists() {
                LocalNode::open(&data_dir)?
            } else {
                LocalNode::init(&data_dir)?
            };
            run_oracle_demo(&mut node)?;
            node.oracle.persist(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.oracle.metrics_json())?);
fn run_asset(command: AssetCommand) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        AssetCommand::List { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            let assets = node.native_assets()?;
            println!("{}", serde_json::to_string_pretty(&assets.registry.list_public())?);
        }
        AssetCommand::Show { data_dir, asset } => {
            let node = LocalNode::open(&data_dir)?;
            let assets = node.native_assets()?;
            let id = NativeAssetId::parse(&asset)?;
            let def = assets.registry.get(id)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "asset_id": def.asset_id.as_str(),
                    "display_name": def.display_name,
                    "ticker_status": def.ticker_status,
                    "precision": def.precision,
                    "status": def.status.as_str(),
                    "authority": "NATIVE_BLOCKCHAIN_AUTHORITY",
                    "application_supply_imported": false,
                }))?
            );
        }
        AssetCommand::Supply { data_dir, asset } => {
            let node = LocalNode::open(&data_dir)?;
            let assets = node.native_assets()?;
            let id = NativeAssetId::parse(&asset)?;
            println!("{}", serde_json::to_string_pretty(&assets.public_supply(id))?);
        }
        AssetCommand::Holdings { data_dir, actor } => {
            let node = LocalNode::open(&data_dir)?;
            let assets = node.native_assets()?;
            println!("{}", serde_json::to_string_pretty(&assets.holdings_for(&actor))?);
        }
        AssetCommand::Locks { data_dir, actor } => {
            let node = LocalNode::open(&data_dir)?;
            let assets = node.native_assets()?;
            println!("{}", serde_json::to_string_pretty(&assets.locks_for(&actor))?);
        }
        AssetCommand::Transfer { data_dir, from, to, asset, quantity } => {
            let mut node = LocalNode::open(&data_dir)?;
            let id = NativeAssetId::parse(&asset)?;
            let qty: u128 = quantity.parse()?;
            let payload = NativeAssetPayload::transfer(&from, to, AssetQuantity::new(id, qty)?);
            let nonce = node.store.view.next_nonce(&development_fixture_secret().public_key());
            let unsigned = UnsignedTransaction {
                network_id: LOCAL_DEV_NETWORK_ID.to_string(),
                chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
                codec_id: SRCB_CODEC_ID.to_string(),
                schema_version: SCHEMA_VERSION,
                family: TransactionFamily::NativeAsset,
                nonce,
                idempotency_key: format!("xfer-{from}-{nonce}"),
                payload: payload.encode(),
            };
            let tx = node.sign_dev_tx(unsigned, &development_fixture_secret())?;
            let tx_id = node.submit_signed(tx)?;
            let block = node.produce_block()?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "tx_id": tx_id,
                    "block": block,
                }))?
            );
        }
        AssetCommand::Faucet { data_dir, asset, recipient, quantity, auth_id } => {
            let mut node = LocalNode::open(&data_dir)?;
            if node.genesis().production_network_enabled {
                return Err("faucet forbidden: production network".into());
            }
            println!("{}", serde_json::to_string_pretty(&faucet_notice())?);
            let id = NativeAssetId::parse(&asset)?;
            let qty: u128 = quantity.parse()?;
            let payload = NativeAssetPayload {
                version: 1,
                op: NativeAssetOp::Issue,
                actor_id: "dev.faucet".to_string(),
                asset_id: id,
                quantity: qty,
                counterparty: recipient.clone(),
                lock_id: String::new(),
                lock_purpose: None,
                expiration_height: None,
                authorized_releaser: String::new(),
                authorization_id: auth_id.clone(),
                issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
                proof_reference: format!("faucet:{auth_id}"),
                economic_unit_label: "DEVELOPMENT_ECONOMIC_UNIT".to_string(),
            };
            let auth = IssuanceAuthorization {
                authorization_id: auth_id,
                asset_id: id,
                recipient,
                quantity: qty,
                issuance_policy: DEVELOPMENT_FAUCET_POLICY.to_string(),
                proof_reference: payload.proof_reference.clone(),
                governance_policy_reference: "gov.native.dev.v1".to_string(),
                expiration_height: 10_000,
                issuer: DEV_FAUCET_ISSUER.to_string(),
                suite_id: String::new(),
                algorithm_id: String::new(),
                public_key: vec![],
                signature: vec![],
                network_id: LOCAL_DEV_NETWORK_ID.to_string(),
                chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
            };
            let bytes = encode_issue_bytes(&payload, auth, &development_fixture_secret())?;
            let nonce = node.store.view.next_nonce(&development_fixture_secret().public_key());
            let unsigned = UnsignedTransaction {
                network_id: LOCAL_DEV_NETWORK_ID.to_string(),
                chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
                codec_id: SRCB_CODEC_ID.to_string(),
                schema_version: SCHEMA_VERSION,
                family: TransactionFamily::NativeAsset,
                nonce,
                idempotency_key: format!("faucet-{nonce}"),
                payload: bytes,
            };
            let tx = node.sign_dev_tx(unsigned, &development_fixture_secret())?;
            let tx_id = node.submit_signed(tx)?;
            let block = node.produce_block()?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "environment": "development/simulation",
                    "tx_id": tx_id,
                    "block": block,
                    "economic_unit_label": "DEVELOPMENT_ECONOMIC_UNIT",
                }))?
            );
        }
        AssetCommand::Reconciliation { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            let assets = node.native_assets()?;
            assets.reconcile_all()?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "matched": true,
                    "sunrey": assets.public_supply(NativeAssetId::SunReyCoin),
                    "moonrey": assets.public_supply(NativeAssetId::MoonReyCoin),
                    "authority": "NATIVE_BLOCKCHAIN_AUTHORITY",
                }))?
            );
        }
    }
    Ok(())
}

fn run_oracle_demo(node: &mut LocalNode) -> Result<(), Box<dyn std::error::Error>> {
    let suite = DevEd25519Sha256Suite;
    for (label, class) in [
        ("energy-a", OracleType::InstitutionalDataProvider),
        ("energy-b", OracleType::RegulatedProvider),
        ("energy-c", OracleType::PublicDataProvider),
    ] {
        let secret = seed_secret(label);
        node.oracle.register_provider(OracleProviderRecord {
            oracle_id: format!("oracle_{label}"),
            controller_actor: format!("actor_{label}"),
            oracle_type: class,
            public_key: secret.public_key(),
            crypto_suite: suite.suite_id().to_string(),
            authorized_feed_types: vec![FactType::EnergyProduction, FactType::ComputeUsage],
            status: ProviderStatus::Active,
            activation_height: 1,
        })?;
    }
    node.oracle.register_feed(development_energy_feed())?;
    node.oracle.register_feed(development_compute_feed())?;
    for (label, value) in ["energy-a", "energy-b", "energy-c"].iter().zip([100u64, 102, 104]) {
        let observation = sign_observation(
            &suite,
            &seed_secret(label),
            OracleObservation {
                observation_id: String::new(),
                oracle_id: format!("oracle_{label}"),
                feed_id: "feed_energy_production_sim".into(),
                subject: "plant_sim_1".into(),
                mantissa: value,
                unit: UnitCode::Mwh,
                measurement_start: node.oracle.now_unix,
                measurement_end: node.oracle.now_unix + 60,
                observation_time: node.oracle.now_unix + 30,
                valid_until: node.oracle.now_unix + 3_600,
                sequence: 1,
                weight: 1,
                network_id: node.oracle.network_id.clone(),
                chain_id: node.oracle.chain_id.clone(),
                crypto_suite: String::new(),
                signature: Vec::new(),
            },
        )?;
        node.oracle.submit_observation(&suite, observation)?;
    }
    let fact = node.oracle.finalize_window(
        "feed_energy_production_sim",
        "plant_sim_1",
        node.oracle.now_unix,
        node.oracle.now_unix + 60,
    )?;
    println!(
        "energy_fact_id={} value={} snapshot={}",
        fact.fact_id,
        fact.aggregated_value,
        snapshot_hash(&node.oracle)
    );
fn run_fees(command: FeesCommand) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        FeesCommand::Schedule { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.fees_schedule_json())?);
        }
        FeesCommand::Estimate { data_dir, bytes, signatures } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.fees_estimate(bytes, signatures))?);
        }
        FeesCommand::Receipt { data_dir, tx } => {
            let node = LocalNode::open(&data_dir)?;
            let receipt = node.fees_receipt(&tx).ok_or("fee receipt not found")?;
            println!("{}", serde_json::to_string_pretty(&receipt)?);
        }
        FeesCommand::Resources { data_dir, tx } => {
            let node = LocalNode::open(&data_dir)?;
            let resources = node.fees_resources(&tx).ok_or("resource usage not found")?;
            println!("{}", serde_json::to_string_pretty(&resources)?);
        }
        FeesCommand::Rewards { data_dir, validator } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.fees_rewards(&validator))?);
        }
        FeesCommand::Policy { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            println!("{}", serde_json::to_string_pretty(&node.fees_policy_json())?);
        }
    }
    Ok(())
}

fn run_protocol(command: ProtocolCommand) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        ProtocolCommand::Version { data_dir } => {
            let node = LocalNode::open(&data_dir)?;
            let commits = node.governance.commitments();
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "protocol_version": commits.protocol_version,
                    "consensus_params_hash": sunrey_protocol::hash_to_hex(&commits.consensus_params_hash),
                    "module_registry_hash": sunrey_protocol::hash_to_hex(&commits.module_registry_hash),
                    "codec_registry_hash": sunrey_protocol::hash_to_hex(&commits.codec_registry_hash),
                    "crypto_policy_hash": sunrey_protocol::hash_to_hex(&commits.crypto_policy_hash),
                    "environment": "simulation",
                }))?
            );
        }
    }
    Ok(())
}

fn load_productive(
    data_dir: &PathBuf,
) -> Result<sunrey_productive::ProductiveStore, Box<dyn std::error::Error>> {
    Ok(sunrey_productive::ProductiveStore::load(data_dir)?)
}

fn run_productive(command: ProductiveCommand) -> Result<(), Box<dyn std::error::Error>> {
    let (data_dir, args) = match command {
        ProductiveCommand::Object { data_dir, id } => {
            let mut args = vec!["productive".into(), "object".into()];
            if let Some(id) = id {
                args.push(id);
            }
            (data_dir, args)
        }
        ProductiveCommand::Claim { data_dir } => {
            (data_dir, vec!["productive".into(), "claim".into()])
        }
        ProductiveCommand::Verify { data_dir, id } => {
            let mut args = vec!["productive".into(), "verify".into()];
            if let Some(id) = id {
                args.push(id);
            }
            (data_dir, args)
        }
        ProductiveCommand::Contribution { data_dir, id } => {
            let mut args = vec!["productive".into(), "contribution".into()];
            if let Some(id) = id {
                args.push(id);
            }
            (data_dir, args)
        }
        ProductiveCommand::Lineage { data_dir, id } => {
            (data_dir, vec!["productive".into(), "lineage".into(), id])
        }
        ProductiveCommand::Graph { data_dir } => {
            (data_dir, vec!["productive".into(), "graph".into()])
        }
    };
    let store = load_productive(&data_dir)?;
    println!("{}", sunrey_productive::run_command(&args, &store)?);
    Ok(())
}

fn run_moonrey(command: MoonreyCommand) -> Result<(), Box<dyn std::error::Error>> {
    let (data_dir, args) = match command {
        MoonreyCommand::Policy { data_dir } => (data_dir, vec!["moonrey".into(), "policy".into()]),
        MoonreyCommand::Issuance { data_dir, id } => {
            let mut args = vec!["moonrey".into(), "issuance".into()];
            if let Some(id) = id {
                args.push(id);
            }
            (data_dir, args)
        }
        MoonreyCommand::Attribution { data_dir } => {
            (data_dir, vec!["moonrey".into(), "attribution".into()])
        }
    };
    let store = load_productive(&data_dir)?;
    println!("{}", sunrey_productive::run_command(&args, &store)?);
    Ok(())
}

fn run_consensus(command: ConsensusCommand) -> Result<(), Box<dyn std::error::Error>> {
    match command {
        ConsensusCommand::Harness => {
            let mut harness = FourValidatorHarness::open_ephemeral()?;
            let finalized = harness.drive_until_commit(64)?;
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "environment": "simulation",
                    "production_ready": false,
                    "validators": 4,
                    "height": finalized.height.get(),
                    "round": finalized.round.get(),
                    "block_id": finalized.block_id.hex(),
                    "certificate_votes": finalized.certificate.votes.len(),
                    "note": "in-process four-validator Tendermint-family harness; not a public network",
                }))?
            );
        }
        ConsensusCommand::Validator { command } => {
            println!("{}", sunrey_validators::run_validator_command(command)?);
        }
        other => {
            let (data_dir, validator) = match &other {
                ConsensusCommand::Status { data_dir, validator }
                | ConsensusCommand::Validators { data_dir, validator }
                | ConsensusCommand::Params { data_dir, validator }
                | ConsensusCommand::Commit { data_dir, validator, .. }
                | ConsensusCommand::WalStatus { data_dir, validator } => {
                    (data_dir.clone(), validator.clone())
                }
                ConsensusCommand::Harness | ConsensusCommand::Validator { .. } => unreachable!(),
            };
            let engine = open_cli_engine(&data_dir, &validator)?;
            match other {
                ConsensusCommand::Status { .. } => {
                    println!("{}", serde_json::to_string_pretty(&engine.status_json())?);
                }
                ConsensusCommand::Validators { .. } => {
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&serde_json::json!({
                            "version": engine.validators.version,
                            "total_active_power": engine.validators.total_active_power()?,
                            "validators": engine.validators.validators.iter().map(|v| {
                                serde_json::json!({
                                    "id": v.validator_id.as_str(),
                                    "voting_power": v.voting_power,
                                    "proposer_priority": v.proposer_priority,
                                })
                            }).collect::<Vec<_>>(),
                        }))?
                    );
                }
                ConsensusCommand::Params { .. } => {
                    println!("{}", serde_json::to_string_pretty(&engine.params)?);
                }
                ConsensusCommand::Commit { height, .. } => {
                    if let Some(cert) = engine.commits.get(&height) {
                        println!(
                            "{}",
                            serde_json::to_string_pretty(&serde_json::json!({
                                "height": cert.height.get(),
                                "round": cert.round.get(),
                                "block_id": cert.block_id.hex(),
                                "votes": cert.votes.len(),
                                "validator_set_version": cert.validator_set_version,
                            }))?
                        );
                    } else {
                        return Err(format!("no commit certificate at height {height}").into());
                    }
                }
                ConsensusCommand::WalStatus { .. } => {
                    println!("{}", serde_json::to_string_pretty(&engine.wal_status())?);
                }
                ConsensusCommand::Harness | ConsensusCommand::Validator { .. } => unreachable!(),
            }
        }
    }
    Ok(())
}

fn open_cli_engine(
    data_dir: &std::path::Path,
    validator: &str,
) -> Result<ConsensusEngine<MemoryApp, DevEd25519Sha256Suite>, sunrey_consensus::ConsensusError> {
    let base = data_dir.join(validator);
    ConsensusEngine::open(
        EngineConfig::development(validator),
        DevEd25519Sha256Suite,
        MemoryApp::default(),
        ConsensusParams::development(),
        four_validator_set()?,
        Some(development_secret(validator)),
        EnginePaths {
            wal: Some(&base.join("consensus.wal")),
            signer: Some(&base.join("signer.bin")),
        },
    )
}

fn warn_interval(interval: u64) {
    info!(
        event = "dev_interval",
        interval_ms = interval,
        producer = DEV_BLOCK_PRODUCER,
        "DEV_BLOCK_PRODUCER interval mode is local development only"
    );
}

fn demo_system_tx(node: &LocalNode) -> Result<Vec<u8>, sunrey_protocol::RejectReason> {
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::System,
        nonce: 0,
        idempotency_key: "demo-system-1".to_string(),
        payload: encode_system_payload(&SystemPayload {
            op: "SET_OBJECT".to_string(),
            object_key: "demo.note".to_string(),
            object_value: b"local-development-simulation".to_vec(),
        }),
    };
    Ok(node.sign_dev_tx(unsigned, &development_fixture_secret())?.encode())
}

fn demo_evidence_tx(node: &LocalNode) -> Result<Vec<u8>, sunrey_protocol::RejectReason> {
    let unsigned = UnsignedTransaction {
        network_id: LOCAL_DEV_NETWORK_ID.to_string(),
        chain_id: LOCAL_DEV_CHAIN_ID.to_string(),
        codec_id: SRCB_CODEC_ID.to_string(),
        schema_version: SCHEMA_VERSION,
        family: TransactionFamily::EvidenceAnchor,
        nonce: 0,
        idempotency_key: "demo-evidence-1".to_string(),
        payload: encode_evidence_anchor_payload(&EvidenceAnchorPayload {
            vault_record_hash: "ab".repeat(32),
            schema_id: "evidence.anchor.v1".to_string(),
            purpose: "simulation-anchor".to_string(),
        }),
    };
    Ok(node.sign_dev_tx(unsigned, &development_fixture_secret())?.encode())
}

#[allow(dead_code)]
fn wait_health(addr: &str, deadline: Duration) -> Result<(), sunrey_protocol::RejectReason> {
    let start = Instant::now();
    loop {
        if http_get(addr, "/health").is_ok() {
            return Ok(());
        }
        if start.elapsed() > deadline {
            return Err(sunrey_protocol::RejectReason::NotReady);
        }
        thread::sleep(Duration::from_millis(20));
    }
}

#[allow(dead_code)]
fn _post(addr: &str, path: &str, body: &str) -> Result<String, sunrey_protocol::RejectReason> {
    http_post(addr, path, body)
}
