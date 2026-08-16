//! Development operator surface for machine economic identity.
//!
//! Machines cannot vote, govern, issue Execution Authority, or mint
//! MoonRey. This CLI stores development records only.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{NodeError, NodeResult};

const STORE_NAME: &str = "machine-economy.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct MachineStore {
    identities: Vec<Value>,
    offers: Vec<Value>,
    orders: Vec<Value>,
    escrows: Vec<Value>,
    sessions: Vec<Value>,
    proofs: Vec<Value>,
    settlements: Vec<Value>,
}

fn store_path() -> PathBuf {
    let data_dir = std::env::var("SUNREY_DATA_DIR").unwrap_or_else(|_| "/tmp/sunrey-node".into());
    PathBuf::from(data_dir).join(STORE_NAME)
}

fn load(path: &Path) -> MachineStore {
    if !path.exists() {
        return MachineStore::default();
    }
    fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save(path: &Path, store: &MachineStore) -> NodeResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| NodeError::Store(err.to_string()))?;
    }
    fs::write(
        path,
        serde_json::to_string_pretty(store).unwrap_or_else(|_| "{}".into()),
    )
    .map_err(|err| NodeError::Store(err.to_string()))
}

fn find_identity<'a>(store: &'a MachineStore, machine_id: &str) -> Option<&'a Value> {
    store
        .identities
        .iter()
        .find(|item| item.get("machineId").and_then(Value::as_str) == Some(machine_id))
}

pub fn run_machine_command(args: &[String]) -> NodeResult<String> {
    if args.is_empty() {
        return Err(NodeError::Validation(
            "usage: sunrey-node machine register|show|capabilities|mandate|offers|purchase|escrow|metering|delivery|settlement|revoke".into(),
        ));
    }
    let path = store_path();
    let mut store = load(&path);
    let output = match args[0].as_str() {
        "register" => register(&mut store, &args[1..])?,
        "show" => show(&store, args.get(1).map(String::as_str).unwrap_or(""))?,
        "capabilities" => capabilities(&store, args.get(1).map(String::as_str).unwrap_or(""))?,
        "mandate" => mandate(&store, args.get(1).map(String::as_str).unwrap_or(""))?,
        "offers" => serde_json::to_string_pretty(&store.offers).unwrap_or_default(),
        "purchase" => lookup(
            &store.orders,
            "orderId",
            args.get(1).map(String::as_str).unwrap_or(""),
            "purchase",
        )?,
        "escrow" => lookup(
            &store.escrows,
            "orderId",
            args.get(1).map(String::as_str).unwrap_or(""),
            "escrow",
        )?,
        "metering" => lookup(
            &store.sessions,
            "sessionId",
            args.get(1).map(String::as_str).unwrap_or(""),
            "metering",
        )?,
        "delivery" => lookup(
            &store.proofs,
            "proofId",
            args.get(1).map(String::as_str).unwrap_or(""),
            "delivery",
        )?,
        "settlement" => lookup(
            &store.settlements,
            "settlementId",
            args.get(1).map(String::as_str).unwrap_or(""),
            "settlement",
        )?,
        "revoke" => revoke(&mut store, &args[1..])?,
        other => {
            return Err(NodeError::Validation(format!(
                "unknown machine command {other}; expected register|show|capabilities|mandate|offers|purchase|escrow|metering|delivery|settlement|revoke"
            )));
        }
    };
    save(&path, &store)?;
    Ok(output)
}

fn register(store: &mut MachineStore, args: &[String]) -> NodeResult<String> {
    let machine_id = args.first().ok_or_else(|| {
        NodeError::Validation("usage: sunrey-node machine register <id> <type> <controller>".into())
    })?;
    let machine_type = args.get(1).cloned().unwrap_or_else(|| "DEVICE".into());
    let controller = args.get(2).cloned().unwrap_or_else(|| "controller".into());
    if find_identity(store, machine_id).is_some() {
        return Err(NodeError::Validation("machine already registered".into()));
    }
    let record = json!({
        "schemaVersion": 1,
        "machineId": machine_id,
        "actorId": format!("actor.{machine_id}"),
        "machineType": machine_type,
        "controllerActor": controller,
        "ownerActor": controller,
        "status": "ACTIVE",
        "capabilityManifest": { "capabilities": [] },
        "spendingMandate": null,
        "resourceMandate": null,
        "keys": [{ "purpose": "MACHINE_SIGNING", "status": "ACTIVE", "version": 1 }],
        "cannotValidate": true,
        "cannotGovern": true,
        "cannotIssueMoonRey": true
    });
    store.identities.push(record.clone());
    Ok(serde_json::to_string_pretty(&record).unwrap_or_default())
}

fn show(store: &MachineStore, machine_id: &str) -> NodeResult<String> {
    let identity = find_identity(store, machine_id)
        .ok_or_else(|| NodeError::Validation("machine not found".into()))?;
    Ok(serde_json::to_string_pretty(identity).unwrap_or_default())
}

fn capabilities(store: &MachineStore, machine_id: &str) -> NodeResult<String> {
    let identity = find_identity(store, machine_id)
        .ok_or_else(|| NodeError::Validation("machine not found".into()))?;
    Ok(
        serde_json::to_string_pretty(identity.get("capabilityManifest").unwrap_or(&Value::Null))
            .unwrap_or_default(),
    )
}

fn mandate(store: &MachineStore, machine_id: &str) -> NodeResult<String> {
    let identity = find_identity(store, machine_id)
        .ok_or_else(|| NodeError::Validation("machine not found".into()))?;
    Ok(serde_json::to_string_pretty(&json!({
        "spending": identity.get("spendingMandate"),
        "resource": identity.get("resourceMandate")
    }))
    .unwrap_or_default())
}

fn lookup(items: &[Value], field: &str, id: &str, label: &str) -> NodeResult<String> {
    let found = items
        .iter()
        .find(|item| item.get(field).and_then(Value::as_str) == Some(id))
        .ok_or_else(|| NodeError::Validation(format!("{label} not found")))?;
    Ok(serde_json::to_string_pretty(found).unwrap_or_default())
}

fn revoke(store: &mut MachineStore, args: &[String]) -> NodeResult<String> {
    let machine_id = args.first().ok_or_else(|| {
        NodeError::Validation("usage: sunrey-node machine revoke <id> <controller> <reason>".into())
    })?;
    let reason = if args.len() > 2 {
        args[2..].join(" ")
    } else {
        "controller_revocation".into()
    };
    let identity = store
        .identities
        .iter_mut()
        .find(|item| item.get("machineId").and_then(Value::as_str) == Some(machine_id.as_str()))
        .ok_or_else(|| NodeError::Validation("machine not found".into()))?;
    identity["status"] = json!("REVOKED");
    identity["revocationReason"] = json!(reason);
    for escrow in &mut store.escrows {
        if escrow.get("buyerMachineId").and_then(Value::as_str) == Some(machine_id)
            || escrow.get("providerMachineId").and_then(Value::as_str) == Some(machine_id)
        {
            escrow["status"] = json!("RECOVERY_HOLD");
        }
    }
    Ok(serde_json::to_string_pretty(identity).unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn machine_register_show_and_revoke() {
        let dir = std::env::temp_dir().join(format!("sunrey-machine-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        std::env::set_var("SUNREY_DATA_DIR", &dir);
        let registered = run_machine_command(&[
            "register".into(),
            "bot_1".into(),
            "AI_AGENT".into(),
            "controller_1".into(),
        ])
        .expect("register");
        assert!(registered.contains("bot_1"));
        let shown = run_machine_command(&["show".into(), "bot_1".into()]).expect("show");
        assert!(shown.contains("ACTIVE"));
        let caps = run_machine_command(&["capabilities".into(), "bot_1".into()]).expect("caps");
        assert!(caps.contains("capabilities"));
        let revoked = run_machine_command(&[
            "revoke".into(),
            "bot_1".into(),
            "controller_1".into(),
            "compromise".into(),
        ])
        .expect("revoke");
        assert!(revoked.contains("REVOKED"));
        let _ = fs::remove_dir_all(&dir);
    }
}
