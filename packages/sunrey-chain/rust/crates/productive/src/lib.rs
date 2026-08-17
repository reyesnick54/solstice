//! Derived Global Productive Capacity Graph and MoonRey issuance engine.
//!
//! Authoritative facts are registered objects, rights, oracle facts,
//! productive claims, verified contributions, and finalized issuance
//! receipts. The graph is a rebuildable projection.
//!
//! Development weights are ENGINEERING_SIMULATION_PARAMETERS.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const FORMULA_VERSION: &str = "moonrey.issuance.formula.v1";
pub const WEIGHT_SCALE: u128 = 1_000_000;
pub const PARAMETER_CLASS: &str = "ENGINEERING_SIMULATION_PARAMETERS";
pub const HASH_DOMAIN: &str = "SUNREY_PRODUCTIVE_V1";
pub const POLICY_DOMAIN: &str = "SUNREY_MOONREY_POLICY_V1";
pub const CROSS_CATEGORY_DOMAIN: &str = "SUNREY_MOONREY_EVENT_V1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RoundingMode {
    Floor,
    Ceil,
    RoundHalfEven,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ClaimType {
    Capacity,
    Output,
    Delivery,
    Usage,
    Reserve,
}

#[derive(Debug, thiserror::Error)]
pub enum ProductiveError {
    #[error("unknown command")]
    UnknownCommand,
    #[error("{0}")]
    Validation(String),
    #[error("io: {0}")]
    Io(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FormulaResult {
    pub formula_version: String,
    pub eligible_quantity: String,
    pub category_weight: String,
    pub claim_type_weight: String,
    pub quality_factor: String,
    pub rounding_mode: RoundingMode,
    pub uncapped_quantity: String,
    pub moonrey_quantity: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct NativeAssetSupplyState {
    pub asset_id: String,
    pub issued: String,
    pub burned: String,
    pub locked: String,
    pub holdings: String,
}

impl NativeAssetSupplyState {
    pub fn moonrey() -> Self {
        Self {
            asset_id: "MOONREY_COIN".into(),
            issued: "0".into(),
            burned: "0".into(),
            locked: "0".into(),
            holdings: "0".into(),
        }
    }

    pub fn reconciles(&self) -> bool {
        parse_u128(&self.holdings) == parse_u128(&self.issued) - parse_u128(&self.burned)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub kind: String,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct FinalizedFacts {
    pub objects: Vec<FactRecord>,
    pub claims: Vec<FactRecord>,
    pub facts: Vec<FactRecord>,
    pub contributions: Vec<FactRecord>,
    pub receipts: Vec<FactRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FactRecord {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub links: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProductiveCapacityGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub projection_hash: String,
}

pub fn mul_div(value: u128, numerator: u128, denominator: u128, rounding: RoundingMode) -> u128 {
    assert!(denominator > 0, "denominator must be positive");
    let product = value.checked_mul(numerator).expect("overflow");
    let quotient = product / denominator;
    let remainder = product % denominator;
    if remainder == 0 {
        return quotient;
    }
    match rounding {
        RoundingMode::Floor => quotient,
        RoundingMode::Ceil => quotient + 1,
        RoundingMode::RoundHalfEven => {
            let twice = remainder.saturating_mul(2);
            if twice < denominator {
                quotient
            } else if twice > denominator {
                quotient + 1
            } else if quotient % 2 == 0 {
                quotient
            } else {
                quotient + 1
            }
        }
    }
}

pub fn evaluate_formula(
    eligible: u128,
    category_weight: u128,
    claim_weight: u128,
    quality: u128,
    rounding: RoundingMode,
    maximum: u128,
) -> FormulaResult {
    let after_category = mul_div(eligible, category_weight, WEIGHT_SCALE, rounding);
    let after_claim = mul_div(after_category, claim_weight, WEIGHT_SCALE, rounding);
    let uncapped = mul_div(after_claim, quality, WEIGHT_SCALE, rounding);
    let moonrey = uncapped.min(maximum);
    FormulaResult {
        formula_version: FORMULA_VERSION.into(),
        eligible_quantity: eligible.to_string(),
        category_weight: category_weight.to_string(),
        claim_type_weight: claim_weight.to_string(),
        quality_factor: quality.to_string(),
        rounding_mode: rounding,
        uncapped_quantity: uncapped.to_string(),
        moonrey_quantity: moonrey.to_string(),
    }
}

pub struct FingerprintInput<'a> {
    pub object_id: &'a str,
    pub epoch: u64,
    pub valid_from: u64,
    pub valid_until: u64,
    pub claim_type: &'a str,
    pub category: &'a str,
    pub normalized: u128,
    pub base_unit: &'a str,
    pub oracle_fact_ids: &'a [&'a str],
    pub upstream: &'a [&'a str],
}

pub fn governed_contribution_fingerprint(
    v1: &str,
    actor_id: &str,
    delivery_from: u64,
    delivery_until: u64,
    lineage: &[&str],
) -> String {
    let mut items: Vec<&str> = lineage.to_vec();
    items.sort_unstable();
    let canonical = format!(
        "{POLICY_DOMAIN}|{v1}|{actor_id}|{delivery_from}|{delivery_until}|{}",
        items.join(",")
    );
    hex::encode(Sha256::digest(canonical.as_bytes()))
}

pub fn cross_category_event_fingerprint(
    object_id: &str,
    epoch: u64,
    valid_from: u64,
    valid_until: u64,
    actor_id: &str,
    facts: &[&str],
) -> String {
    let mut items: Vec<&str> = facts.to_vec();
    items.sort_unstable();
    let canonical = format!(
        "{CROSS_CATEGORY_DOMAIN}|{object_id}|{epoch}|{valid_from}|{valid_until}|{actor_id}|{}",
        items.join(",")
    );
    hex::encode(Sha256::digest(canonical.as_bytes()))
}

pub fn ai_cannot_activate_policy(actor_kind: &str) -> bool {
    actor_kind == "AI_PROPOSAL"
}

pub fn contribution_fingerprint(input: FingerprintInput<'_>) -> String {
    let mut facts: Vec<&str> = input.oracle_fact_ids.to_vec();
    facts.sort_unstable();
    let mut up: Vec<&str> = input.upstream.to_vec();
    up.sort_unstable();
    let canonical = format!(
        "{HASH_DOMAIN}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
        input.object_id,
        input.epoch,
        input.valid_from,
        input.valid_until,
        input.claim_type,
        input.category,
        input.normalized,
        input.base_unit,
        facts.join(","),
        up.join(",")
    );
    hex::encode(Sha256::digest(canonical.as_bytes()))
}

pub fn build_graph(facts: &FinalizedFacts) -> ProductiveCapacityGraph {
    let mut nodes: BTreeMap<String, GraphNode> = BTreeMap::new();
    let mut edges: BTreeSet<(String, String, String)> = BTreeSet::new();
    for record in facts
        .objects
        .iter()
        .chain(facts.claims.iter())
        .chain(facts.facts.iter())
        .chain(facts.contributions.iter())
        .chain(facts.receipts.iter())
    {
        nodes.insert(
            record.id.clone(),
            GraphNode {
                id: record.id.clone(),
                kind: record.kind.clone(),
                label: record.label.clone(),
            },
        );
        for (kind, target) in &record.links {
            edges.insert((record.id.clone(), target.clone(), kind.clone()));
        }
    }
    let node_list: Vec<GraphNode> = nodes.into_values().collect();
    let edge_list: Vec<GraphEdge> =
        edges.into_iter().map(|(from, to, kind)| GraphEdge { from, to, kind }).collect();
    let mut parts = vec![HASH_DOMAIN.to_string(), "graph".into()];
    for node in &node_list {
        parts.push(format!("{}:{}:{}", node.kind, node.id, node.label));
    }
    for edge in &edge_list {
        parts.push(format!("{}:{}:{}", edge.kind, edge.from, edge.to));
    }
    let projection_hash = hex::encode(Sha256::digest(parts.join("|").as_bytes()));
    ProductiveCapacityGraph { nodes: node_list, edges: edge_list, projection_hash }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductiveStore {
    pub facts: FinalizedFacts,
    pub supply: NativeAssetSupplyState,
    pub policy_version: u32,
    pub parameter_class: String,
}

impl ProductiveStore {
    pub fn development() -> Self {
        Self {
            facts: FinalizedFacts::default(),
            supply: NativeAssetSupplyState::moonrey(),
            policy_version: 1,
            parameter_class: PARAMETER_CLASS.into(),
        }
    }

    pub fn load(dir: impl AsRef<Path>) -> Result<Self, ProductiveError> {
        let path = dir.as_ref().join("productive.json");
        if !path.exists() {
            return Ok(Self::development());
        }
        let text =
            std::fs::read_to_string(&path).map_err(|e| ProductiveError::Io(e.to_string()))?;
        serde_json::from_str(&text).map_err(|e| ProductiveError::Io(e.to_string()))
    }

    pub fn persist(&self, dir: impl AsRef<Path>) -> Result<(), ProductiveError> {
        let path = dir.as_ref().join("productive.json");
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| ProductiveError::Io(e.to_string()))?;
        }
        let text =
            serde_json::to_string_pretty(self).map_err(|e| ProductiveError::Io(e.to_string()))?;
        std::fs::write(path, text).map_err(|e| ProductiveError::Io(e.to_string()))
    }

    pub fn graph(&self) -> ProductiveCapacityGraph {
        build_graph(&self.facts)
    }
}

pub fn run_command(args: &[String], store: &ProductiveStore) -> Result<String, ProductiveError> {
    if args.is_empty() {
        return Err(ProductiveError::UnknownCommand);
    }
    match args[0].as_str() {
        "productive" => productive_command(&args[1..], store),
        "moonrey" => moonrey_command(&args[1..], store),
        _ => Err(ProductiveError::UnknownCommand),
    }
}

fn productive_command(args: &[String], store: &ProductiveStore) -> Result<String, ProductiveError> {
    let action = args.first().map(String::as_str).unwrap_or("");
    let payload = match action {
        "object" => json_list(&store.facts.objects, args.get(1).map(String::as_str)),
        "claim" => json_list(&store.facts.claims, args.get(1).map(String::as_str)),
        "verify" => {
            serde_json::json!({"plane":"productive","action":"verify","note":"verification is deterministic from finalized facts"})
        }
        "contribution" => json_list(&store.facts.contributions, args.get(1).map(String::as_str)),
        "lineage" => {
            let id = args.get(1).ok_or_else(|| {
                ProductiveError::Validation("usage: productive lineage <contributionId>".into())
            })?;
            store
                .facts
                .contributions
                .iter()
                .find(|item| item.id == *id)
                .cloned()
                .map(|item| serde_json::to_value(item).unwrap_or_default())
                .unwrap_or(serde_json::Value::Null)
        }
        "graph" => serde_json::to_value(store.graph()).unwrap_or_default(),
        _ => {
            return Err(ProductiveError::Validation(
                "expected object|claim|verify|contribution|lineage|graph".into(),
            ))
        }
    };
    Ok(serde_json::to_string_pretty(&payload).unwrap_or_default())
}

fn moonrey_command(args: &[String], store: &ProductiveStore) -> Result<String, ProductiveError> {
    let action = args.first().map(String::as_str).unwrap_or("");
    let payload = match action {
        "policy" => serde_json::json!({
            "policy_version": store.policy_version,
            "parameter_class": store.parameter_class,
            "formula_version": FORMULA_VERSION,
        }),
        "issuance" => json_list(&store.facts.receipts, args.get(1).map(String::as_str)),
        "attribution" => serde_json::json!({
            "receipts": store.facts.receipts,
            "supply": store.supply,
            "reconciles": store.supply.reconciles(),
        }),
        _ => {
            return Err(ProductiveError::Validation("expected policy|issuance|attribution".into()))
        }
    };
    Ok(serde_json::to_string_pretty(&payload).unwrap_or_default())
}

fn json_list(records: &[FactRecord], id: Option<&str>) -> serde_json::Value {
    if let Some(id) = id {
        return records
            .iter()
            .find(|item| item.id == id)
            .cloned()
            .map(|item| serde_json::to_value(item).unwrap_or_default())
            .unwrap_or(serde_json::Value::Null);
    }
    serde_json::to_value(records).unwrap_or_default()
}

fn parse_u128(value: &str) -> u128 {
    value.parse().unwrap_or(0)
}

pub fn energy_demo_facts() -> FinalizedFacts {
    let mut facts = FinalizedFacts::default();
    facts.objects.push(FactRecord {
        id: "obj.solar.alpha".into(),
        kind: "PRODUCTIVE_OBJECT".into(),
        label: "ENERGY".into(),
        links: BTreeMap::from([
            ("OWNS".into(), "owner:ctl.obj.solar.alpha".into()),
            ("LOCATED_IN".into(), "location:geo.dev.sim".into()),
        ]),
    });
    facts.claims.push(FactRecord {
        id: "claim.solar.output".into(),
        kind: "OUTPUT_CLAIM".into(),
        label: "OUTPUT".into(),
        links: BTreeMap::from([("PRODUCES".into(), "obj.solar.alpha".into())]),
    });
    for index in 1..=3 {
        facts.facts.push(FactRecord {
            id: format!("fact.obj.solar.alpha.{index}"),
            kind: "ORACLE_FACT".into(),
            label: format!("oracle.{index}"),
            links: BTreeMap::from([("VERIFIED_BY".into(), "obj.solar.alpha".into())]),
        });
    }
    facts.contributions.push(FactRecord {
        id: "vpc.energy".into(),
        kind: "VERIFIED_CONTRIBUTION".into(),
        label: "OUTPUT".into(),
        links: BTreeMap::from([("DERIVED_FROM".into(), "obj.solar.alpha".into())]),
    });
    facts.receipts.push(FactRecord {
        id: "mir.energy".into(),
        kind: "ISSUANCE_RECEIPT".into(),
        label: "MOONREY".into(),
        links: BTreeMap::from([("DERIVED_FROM".into(), "vpc.energy".into())]),
    });
    facts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formula_is_deterministic() {
        let first = evaluate_formula(
            1_200_000,
            WEIGHT_SCALE,
            WEIGHT_SCALE,
            WEIGHT_SCALE,
            RoundingMode::Floor,
            10_000_000,
        );
        let second = evaluate_formula(
            1_200_000,
            WEIGHT_SCALE,
            WEIGHT_SCALE,
            WEIGHT_SCALE,
            RoundingMode::Floor,
            10_000_000,
        );
        assert_eq!(first, second);
        assert_eq!(first.moonrey_quantity, "1200000");
        assert_eq!(mul_div(10, 1, 3, RoundingMode::Floor), 3);
        assert_eq!(mul_div(10, 1, 3, RoundingMode::Ceil), 4);
        assert_eq!(mul_div(10, 1, 4, RoundingMode::RoundHalfEven), 2);
    }

    #[test]
    fn governed_fingerprint_includes_actor_and_rejects_ai_activation() {
        let v1 = contribution_fingerprint(FingerprintInput {
            object_id: "obj.solar.alpha",
            epoch: 1,
            valid_from: 10,
            valid_until: 20,
            claim_type: "OUTPUT",
            category: "ENERGY",
            normalized: 1_200_000,
            base_unit: "Wh",
            oracle_fact_ids: &["fact.2", "fact.1"],
            upstream: &[],
        });
        let left = governed_contribution_fingerprint(&v1, "actor.1", 10, 20, &["claim.a", "claim.b"]);
        let right = governed_contribution_fingerprint(&v1, "actor.1", 10, 20, &["claim.b", "claim.a"]);
        assert_eq!(left, right);
        let event_left = cross_category_event_fingerprint("obj.shared", 1, 10, 20, "op.1", &["f2", "f1"]);
        let event_right = cross_category_event_fingerprint("obj.shared", 1, 10, 20, "op.1", &["f1", "f2"]);
        assert_eq!(event_left, event_right);
        assert!(ai_cannot_activate_policy("AI_PROPOSAL"));
        assert!(!ai_cannot_activate_policy("PROTOCOL_GOVERNANCE"));
    }

    #[test]
    fn fingerprint_is_order_independent() {
        let left = contribution_fingerprint(FingerprintInput {
            object_id: "obj.solar.alpha",
            epoch: 1,
            valid_from: 10,
            valid_until: 20,
            claim_type: "OUTPUT",
            category: "ENERGY",
            normalized: 1_200_000,
            base_unit: "Wh",
            oracle_fact_ids: &["fact.2", "fact.1"],
            upstream: &[],
        });
        let right = contribution_fingerprint(FingerprintInput {
            object_id: "obj.solar.alpha",
            epoch: 1,
            valid_from: 10,
            valid_until: 20,
            claim_type: "OUTPUT",
            category: "ENERGY",
            normalized: 1_200_000,
            base_unit: "Wh",
            oracle_fact_ids: &["fact.1", "fact.2"],
            upstream: &[],
        });
        assert_eq!(left, right);
    }

    #[test]
    fn four_validators_rebuild_the_same_graph() {
        let facts = energy_demo_facts();
        let hashes: Vec<String> = (0..4).map(|_| build_graph(&facts).projection_hash).collect();
        assert!(hashes.iter().all(|hash| hash == &hashes[0]));
        let empty = build_graph(&FinalizedFacts::default());
        assert_ne!(empty.projection_hash, hashes[0]);
        let rebuilt = build_graph(&facts);
        assert_eq!(rebuilt.projection_hash, hashes[0]);
    }

    #[test]
    fn supply_reconciles_issued_minus_burned() {
        let mut supply = NativeAssetSupplyState::moonrey();
        supply.issued = "1200".into();
        supply.holdings = "1200".into();
        assert!(supply.reconciles());
        supply.burned = "200".into();
        supply.holdings = "1000".into();
        assert!(supply.reconciles());
        supply.holdings = "999".into();
        assert!(!supply.reconciles());
    }

    #[test]
    fn cli_planes_exist() {
        let mut store = ProductiveStore::development();
        store.facts = energy_demo_facts();
        store.supply.issued = "1200".into();
        store.supply.holdings = "1200".into();
        let graph = run_command(&["productive".into(), "graph".into()], &store).unwrap();
        assert!(graph.contains("projection_hash"));
        let policy = run_command(&["moonrey".into(), "policy".into()], &store).unwrap();
        assert!(policy.contains(PARAMETER_CLASS));
        let attribution = run_command(&["moonrey".into(), "attribution".into()], &store).unwrap();
        assert!(attribution.contains("reconciles"));
    }
}
