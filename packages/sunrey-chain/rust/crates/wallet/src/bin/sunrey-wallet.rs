//! sunrey-wallet CLI. Never prints private keys.

use clap::{Parser, Subcommand};
use serde_json::json;
use sunrey_wallet::{encode_address, parse_address, AddressAlgorithm, AddressClass};

#[derive(Parser)]
#[command(name = "sunrey-wallet", about = "SunRey development wallet")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a development address from a public descriptor
    Create {
        #[arg(long)]
        name: String,
        #[arg(long, default_value = "net_sunrey_simulation")]
        network: String,
    },
    /// Show or parse an address
    Address { text: String },
    /// Show account metadata (no balances invented here)
    Account { id: String },
    /// Print that balances come from chain RPC
    Balance { id: String },
    /// Describe how to build an unsigned transfer
    Build,
    /// Refuse to sign without a local development keystore
    Sign,
    /// Point at node RPC submit
    Submit,
    /// Transaction status is read from chain RPC
    Tx { id: String },
    /// History is reconstructed from finalized chain records
    History,
    /// Describe key rotation
    KeyRotate,
    /// Describe recovery
    Recovery,
    /// Describe delegated keys
    Delegate,
    /// Watch-only reminder
    Watch,
    /// Application security profile (no private keys)
    Security { id: String },
    /// Bound devices
    Devices { id: String },
    /// Application sessions
    Sessions { id: String },
    /// Destination trust policy
    TrustedDestinations { id: String },
    /// Recovery state (cannot rewrite finalized transfers)
    RecoveryState { id: String },
    /// Key rotation plan (public key only)
    RotateKey { id: String },
    /// Delegated key bindings
    Delegations { id: String },
    /// Security audit report
    Audit { id: String },
}

fn main() {
    let cli = Cli::parse();
    let payload = match cli.command {
        Commands::Create { name, network } => {
            let addr = encode_address(
                &network,
                AddressClass::SingleKey,
                AddressAlgorithm::Ed25519V1,
                name.as_bytes(),
            )
            .expect("address");
            json!({
                "wallet": name,
                "address": addr.text,
                "network": network,
                "version": 1,
                "note": "private keys are not stored in this CLI output"
            })
        }
        Commands::Address { text } => match parse_address(&text, None) {
            Ok(addr) => json!({
                "address": addr.text,
                "network_class": format!("{:?}", addr.network_class),
                "class": format!("{:?}", addr.address_class),
            }),
            Err(err) => json!({"error": err.to_string()}),
        },
        Commands::Account { id } => json!({
            "account_id": id,
            "note": "query GET /wallet/account/{id} on the local node RPC"
        }),
        Commands::Balance { id } => json!({
            "account_id": id,
            "note": "balances are canonical chain holdings, not wallet metadata",
            "rpc": "/wallet/holdings/{id}"
        }),
        Commands::Build => json!({
            "builds": ["native transfer", "lock/unlock", "fee declaration", "machine commerce", "oracle", "governance"],
            "signs": ["max_fee", "fee_asset"],
            "distinguishes": ["estimated_fee", "maximum_authorized_fee", "actual_finalized_fee"]
        }),
        Commands::Sign => json!({
            "error": "this binary does not hold private keys; use the TypeScript development keystore or a hardware signer port"
        }),
        Commands::Submit => json!({
            "rpc": "POST /tx",
            "note": "submit signed canonical bytes only"
        }),
        Commands::Tx { id } => json!({"tx_id": id, "rpc": "/wallet/tx/{id}"}),
        Commands::History => json!({
            "note": "wallet history is a rebuildable projection of finalized chain records"
        }),
        Commands::KeyRotate => json!({
            "process": ["current authorization", "register next key", "activation condition", "old key historical"]
        }),
        Commands::Recovery => json!({
            "kinds": ["OWNER_RECOVERY_KEY", "M_OF_N_RECOVERY_GUARDIANS", "INSTITUTIONAL_RECOVERY", "HARDWARE_BACKUP"],
            "delay": "height-based",
            "guardians_spend": false
        }),
        Commands::Delegate => json!({
            "limits": ["transaction type", "asset", "amount", "total", "expiration height", "counterparty", "purpose", "fee ceiling"],
            "inherits_master": false
        }),
        Commands::Watch => json!({
            "can": ["query", "build unsigned", "monitor finality"],
            "cannot": ["sign", "rotate", "recover"]
        }),
        Commands::Security { id } => json!({
            "wallet_id": id,
            "login_is_not_signing": true,
            "passkey_is_not_native_key": true,
            "custody_classes": ["SELF_CUSTODY", "ASSISTED_SELF_CUSTODY", "INSTITUTIONAL_CUSTODY", "MACHINE_CONTROLLED", "DELEGATED_AGENT"],
            "note": "query the TypeScript WalletSecurityEngine; this binary does not hold private keys"
        }),
        Commands::Devices { id } => json!({
            "wallet_id": id,
            "trust_states": ["NEW", "VERIFIED", "TRUSTED", "RESTRICTED", "REVOKED"],
            "public_only": true
        }),
        Commands::Sessions { id } => json!({
            "wallet_id": id,
            "scopes": ["READ_ONLY", "TRANSACTION_PREVIEW", "TRANSACTION_APPROVAL", "TRADING", "PROFILE_MANAGEMENT", "RECOVERY_ADMIN"],
            "grants_native_signing": false
        }),
        Commands::TrustedDestinations { id } => json!({
            "wallet_id": id,
            "states": ["UNRECOGNIZED", "PENDING_VERIFICATION", "TRUSTED", "RESTRICTED", "REVOKED"]
        }),
        Commands::RecoveryState { id } => json!({
            "wallet_id": id,
            "rewrites_finalized": false,
            "guardian_spend": false
        }),
        Commands::RotateKey { id } => json!({
            "wallet_id": id,
            "accepts": "new public key",
            "rejects": "plaintext seed"
        }),
        Commands::Delegations { id } => json!({
            "wallet_id": id,
            "inherits_master": false
        }),
        Commands::Audit { id } => json!({
            "wallet_id": id,
            "reconciles": ["devices", "sessions", "signing authorities", "delegations", "recovery", "destinations", "pending actions"],
            "private_keys": false
        }),
    };
    let text = serde_json::to_string_pretty(&payload).expect("json");
    if text.to_lowercase().contains("private") && text.contains("key material") {
        panic!("refusing to print private key material");
    }
    println!("{text}");
}
