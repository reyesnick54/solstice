use std::fs;
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, Instant};

use clap::{Parser, Subcommand};
use sunrey_consensus::{
    development_secret, four_validator_set, ConsensusEngine, ConsensusParams, EngineConfig,
    EnginePaths, FourValidatorHarness, MemoryApp,
};
use sunrey_crypto::{development_fixture_secret, DevEd25519Sha256Suite};
use sunrey_node::{LocalNode, DEV_BLOCK_PRODUCER, NODE_ROLE};
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
