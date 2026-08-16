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
        _ => Err(NodeError::Validation(
            "unknown command; expected evidence or validator".into(),
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
