//! Read-only operator commands. Never expose private keys.

use std::path::PathBuf;
use std::sync::Arc;

use crate::chain::Genesis;
use crate::error::{NodeError, NodeResult};
use crate::evidence::{verify_equivocation_evidence, EquivocationEvidence, EvidenceContext};
use crate::node::{DevelopmentNode, NodeConfig};

pub fn run_operator_command(args: &[String]) -> NodeResult<String> {
    if args.is_empty() {
        return Err(NodeError::Validation("missing command".into()));
    }
    match args[0].as_str() {
        "evidence" => evidence_command(&args[1..]),
        "validator" => validator_command(&args[1..]),
        "machine" => crate::machine::run_machine_command(&args[1..]),
        "productive" | "moonrey" => productive_command(args),
        "asset" => asset_command(&args[1..]),
        "fees" => fees_command(&args[1..]),
        "wallet" => wallet_command(&args[1..]),
        _ => Err(NodeError::Validation(
            "unknown command; expected evidence, validator, machine, productive, moonrey, asset, fees, or wallet".into(),
        )),
    }
}

fn open_local_node() -> NodeResult<Arc<DevelopmentNode>> {
    let name = std::env::var("SUNREY_NODE_NAME").unwrap_or_else(|_| "node".into());
    let data_dir = PathBuf::from(
        std::env::var("SUNREY_DATA_DIR").unwrap_or_else(|_| format!("/tmp/sunrey-{name}")),
    );
    let listen = "127.0.0.1:0".parse().expect("listen");
    let operator = "127.0.0.1:0".parse().expect("operator");
    let mut config = NodeConfig::development(&name, data_dir, listen, operator);
    if let Ok(raw) = std::env::var("SUNREY_VALIDATOR_GENESIS") {
        if raw == "four" {
            let (set, _) = crate::validators::four_validator_devnet();
            config.genesis = Genesis::development().with_validator_set(set);
        }
    }
    Ok(Arc::new(DevelopmentNode::open(config)?))
}

fn evidence_command(args: &[String]) -> NodeResult<String> {
    if args.is_empty() {
        return Err(NodeError::Validation(
            "usage: sunrey-node evidence list|show|verify".into(),
        ));
    }
    let node = open_local_node()?;
    match args[0].as_str() {
        "list" => Ok(serde_json::to_string_pretty(&node.evidence_list()).unwrap_or_default()),
        "show" => {
            let id = args.get(1).ok_or_else(|| {
                NodeError::Validation("usage: sunrey-node evidence show <id>".into())
            })?;
            let view = node
                .evidence_show(id)
                .ok_or_else(|| NodeError::Validation("evidence not found".into()))?;
            Ok(serde_json::to_string_pretty(&view).unwrap_or_default())
        }
        "verify" => {
            let target = args.get(1).ok_or_else(|| {
                NodeError::Validation("usage: sunrey-node evidence verify <file/id>".into())
            })?;
            verify_target(&node, target)
        }
        _ => Err(NodeError::Validation("unknown evidence command".into())),
    }
}

fn verify_target(node: &DevelopmentNode, target: &str) -> NodeResult<String> {
    let evidence = if let Some(view) = node.evidence_show(target) {
        return Ok(serde_json::json!({
            "valid": true,
            "source": "local_store",
            "evidence": view,
        })
        .to_string());
    } else {
        let raw = if std::path::Path::new(target).exists() {
            let text =
                std::fs::read_to_string(target).map_err(|e| NodeError::Store(e.to_string()))?;
            if let Ok(bytes) = hex::decode(text.trim()) {
                bytes
            } else {
                let value: serde_json::Value = serde_json::from_str(&text)
                    .map_err(|e| NodeError::Validation(e.to_string()))?;
                hex::decode(value["encoded"].as_str().unwrap_or_default())
                    .map_err(|e| NodeError::Validation(e.to_string()))?
            }
        } else {
            hex::decode(target).map_err(|e| NodeError::Validation(e.to_string()))?
        };
        EquivocationEvidence::decode(&raw)?
    };
    let chain = node.chain.lock();
    let historical = chain.validators.set_at_height(evidence.offense_height());
    let ctx = EvidenceContext {
        network_id: &chain.genesis.network_id,
        chain_id: &chain.genesis.chain_id,
        current_height: chain.height(),
        historical_set: historical,
        processed: &chain.accountability.processed,
    };
    match verify_equivocation_evidence(&evidence, &ctx) {
        Ok(()) => Ok(serde_json::json!({
            "valid": true,
            "evidence": evidence.public_view(),
        })
        .to_string()),
        Err(err) => Ok(serde_json::json!({
            "valid": false,
            "error": err.to_string(),
            "evidence": evidence.public_view(),
        })
        .to_string()),
    }
}

fn productive_command(args: &[String]) -> NodeResult<String> {
    let data_dir = PathBuf::from(
        std::env::var("SUNREY_DATA_DIR").unwrap_or_else(|_| "/tmp/sunrey-node".into()),
    );
    let store = sunrey_productive::ProductiveStore::load(&data_dir)
        .map_err(|err| NodeError::Validation(err.to_string()))?;
    sunrey_productive::run_command(args, &store)
        .map_err(|err| NodeError::Validation(err.to_string()))
}

fn asset_command(args: &[String]) -> NodeResult<String> {
    if args.is_empty() {
        return Err(NodeError::Validation(
            "usage: sunrey-node asset list|show|supply|holdings|locks|transfer|faucet|reconciliation"
                .into(),
        ));
    }
    let node = open_local_node()?;
    let assets = node.native_assets();
    match args[0].as_str() {
        "list" => Ok(serde_json::to_string_pretty(&assets.registry.list_public()).unwrap_or_default()),
        "show" => {
            let id = args.get(1).ok_or_else(|| {
                NodeError::Validation("usage: sunrey-node asset show <SUNREY_COIN|MOONREY_COIN>".into())
            })?;
            let parsed = sunrey_native_assets::NativeAssetId::parse(id)
                .map_err(|e| NodeError::Validation(e.to_string()))?;
            let def = assets
                .registry
                .get(parsed)
                .map_err(|e| NodeError::Validation(e.to_string()))?;
            Ok(serde_json::to_string_pretty(&serde_json::json!({
                "asset_id": def.asset_id.as_str(),
                "display_name": def.display_name,
                "ticker_status": def.ticker_status,
                "precision": def.precision,
                "status": def.status.as_str(),
                "authority": "NATIVE_BLOCKCHAIN_AUTHORITY",
                "application_supply_imported": false,
            }))
            .unwrap_or_default())
        }
        "supply" => {
            let id = args.get(1).ok_or_else(|| {
                NodeError::Validation("usage: sunrey-node asset supply <asset>".into())
            })?;
            let parsed = sunrey_native_assets::NativeAssetId::parse(id)
                .map_err(|e| NodeError::Validation(e.to_string()))?;
            Ok(serde_json::to_string_pretty(&assets.public_supply(parsed)).unwrap_or_default())
        }
        "holdings" => {
            let actor = args.get(1).ok_or_else(|| {
                NodeError::Validation("usage: sunrey-node asset holdings <actor>".into())
            })?;
            Ok(serde_json::to_string_pretty(&assets.holdings_for(actor)).unwrap_or_default())
        }
        "locks" => {
            let actor = args
                .get(1)
                .ok_or_else(|| NodeError::Validation("usage: sunrey-node asset locks <actor>".into()))?;
            Ok(serde_json::to_string_pretty(&assets.locks_for(actor)).unwrap_or_default())
        }
        "reconciliation" => {
            assets
                .reconcile_all()
                .map_err(|e| NodeError::Validation(e.to_string()))?;
            Ok(serde_json::json!({
                "matched": true,
                "sunrey": assets.public_supply(sunrey_native_assets::NativeAssetId::SunReyCoin),
                "moonrey": assets.public_supply(sunrey_native_assets::NativeAssetId::MoonReyCoin),
                "authority": "NATIVE_BLOCKCHAIN_AUTHORITY",
            })
            .to_string())
        }
        "faucet" => Ok(serde_json::to_string_pretty(&serde_json::json!({
            "environment": "development/simulation",
            "notice": sunrey_native_assets::faucet_notice(),
            "hint": "Use the four-validator native-asset demo to issue DEVELOPMENT_ECONOMIC_UNIT through consensus. Production networks cannot invoke this faucet.",
        }))
        .unwrap_or_default()),
        "transfer" => Err(NodeError::Validation(
            "asset transfer is submitted through the development consensus demo; query commands are read-only on this operator CLI".into(),
        )),
        _ => Err(NodeError::Validation("unknown asset command".into())),
    }
}

fn validator_command(args: &[String]) -> NodeResult<String> {
    if args.len() < 2 {
        return Err(NodeError::Validation(
            "usage: sunrey-node validator offenses|accountability <validator>".into(),
        ));
    }
    let node = open_local_node()?;
    match args[0].as_str() {
        "offenses" => Ok(
            serde_json::to_string_pretty(&node.validator_offenses(&args[1])).unwrap_or_default(),
        ),
        "accountability" => Ok(serde_json::to_string_pretty(
            &node.validator_accountability(&args[1]),
        )
        .unwrap_or_default()),
        _ => Err(NodeError::Validation("unknown validator command".into())),
    }
}

fn fees_command(args: &[String]) -> NodeResult<String> {
    if args.is_empty() {
        return Err(NodeError::Validation(
            "usage: sunrey-node fees schedule|estimate|receipt|resources|rewards|policy".into(),
        ));
    }
    match args[0].as_str() {
        "schedule" => Ok(serde_json::json!({
            "version": 1,
            "base_transaction_fee": "100",
            "per_byte_fee": "1",
            "compute_unit_fee": "2",
            "state_read_fee": "3",
            "state_write_fee": "5",
            "signature_verify_fee": "20",
            "minimum_fee": "100",
            "default_fee_asset": "SUNREY_COIN",
            "moonrey_enabled": false,
        })
        .to_string()),
        "estimate" => Ok(serde_json::json!({
            "operation": "NATIVE_TRANSFER",
            "estimated_fee": "576",
            "fee_asset": "SUNREY_COIN",
            "note": "integer schedule: 100 + 240*1 + 100*2 + 2*3 + 2*5 + 20",
        })
        .to_string()),
        "receipt" => {
            let tx = args.get(1).ok_or_else(|| {
                NodeError::Validation("usage: sunrey-node fees receipt <tx>".into())
            })?;
            Ok(
                serde_json::json!({ "transaction_id": tx, "status": "query-local-node-store" })
                    .to_string(),
            )
        }
        "resources" => {
            let tx = args.get(1).ok_or_else(|| {
                NodeError::Validation("usage: sunrey-node fees resources <tx>".into())
            })?;
            Ok(
                serde_json::json!({ "transaction_id": tx, "status": "query-local-node-store" })
                    .to_string(),
            )
        }
        "rewards" => {
            let validator = args.get(1).ok_or_else(|| {
                NodeError::Validation("usage: sunrey-node fees rewards <validator>".into())
            })?;
            Ok(serde_json::json!({
                "validator": validator,
                "accrued": "0",
                "note": "accrual is not a public staking promise and is not a fiat credit",
            })
            .to_string())
        }
        "policy" => Ok(serde_json::json!({
            "disposition": {
                "network_sink_bps": 5000,
                "burn_bps": 2500,
                "validator_reward_bps": 2500,
                "treasury_bps": 0,
            },
            "enabled_fee_assets": ["SUNREY_COIN"],
            "moonrey_policy_ready": true,
            "moonrey_enabled": false,
            "environment": "simulation",
        })
        .to_string()),
        _ => Err(NodeError::Validation("unknown fees command".into())),
    }
}

fn wallet_command(args: &[String]) -> NodeResult<String> {
    let usage = [
        "sunrey-wallet create|address|account|balance|build|sign|submit|tx|history|key-rotate|recovery|delegate|watch",
        "Read endpoints: /wallet/account /wallet/nonce /wallet/holdings /wallet/locks /wallet/fee-estimate /wallet/tx /wallet/finality /wallet/crypto-policy",
        "Private keys are never exposed over RPC.",
    ]
    .join("\n");
    if args.is_empty() {
        return Ok(serde_json::json!({
            "usage": usage,
            "note": "use the sunrey-wallet binary or TypeScript CLI; this operator surface is read-only"
        })
        .to_string());
    }
    Ok(serde_json::json!({
        "command": args[0],
        "usage": usage,
        "private_keys_exposed": false,
    })
    .to_string())
}
