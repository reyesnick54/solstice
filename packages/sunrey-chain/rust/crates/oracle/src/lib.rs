//! SunRey sovereign oracle network and verified economic fact protocol.
//!
//! Consensus execution never calls HTTP, websites, models, or external
//! databases. Adapters collect off-chain. Validators verify signed
//! [`OracleObservation`] values and finalize [`VerifiedEconomicFact`]s.
//! Facts are protocol evidence, not money.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sunrey_crypto::{CryptoSuite, SigningSecret};
use sunrey_protocol::{encode_string, encode_u64, hash_to_hex, RejectReason, DOMAIN_ORACLE};

mod production;
pub use production::{
    independent_controller_count, production_eligibility_requires_evidence, reject_float_numeric,
    OnboardingStatus,
};

pub const MAX_ORACLE_PAYLOAD_BYTES: usize = 4096;
pub const BASE_RESOURCE_UNITS: u64 = 100;
pub const PER_BYTE_RESOURCE_UNITS: u64 = 1;
pub const MAX_RESOURCE_UNITS: u64 = 5000;
pub const DEV_NETWORK_ID: &str = "net_sunrey_simulation";
pub const DEV_CHAIN_ID: &str = "chn_sunrey_simulation";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OracleType {
    InstitutionalDataProvider,
    RegulatedProvider,
    EnterpriseSensorNetwork,
    DeviceOracle,
    AttestationProvider,
    Auditor,
    PublicDataProvider,
    CompositeOracle,
}

impl OracleType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::InstitutionalDataProvider => "INSTITUTIONAL_DATA_PROVIDER",
            Self::RegulatedProvider => "REGULATED_PROVIDER",
            Self::EnterpriseSensorNetwork => "ENTERPRISE_SENSOR_NETWORK",
            Self::DeviceOracle => "DEVICE_ORACLE",
            Self::AttestationProvider => "ATTESTATION_PROVIDER",
            Self::Auditor => "AUDITOR",
            Self::PublicDataProvider => "PUBLIC_DATA_PROVIDER",
            Self::CompositeOracle => "COMPOSITE_ORACLE",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProviderStatus {
    Registered,
    Active,
    Suspended,
    Revoked,
    Expired,
}

impl ProviderStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Registered => "REGISTERED",
            Self::Active => "ACTIVE",
            Self::Suspended => "SUSPENDED",
            Self::Revoked => "REVOKED",
            Self::Expired => "EXPIRED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FactType {
    EnergyProduction,
    ComputeUsage,
    ReferencePrice,
}

impl FactType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::EnergyProduction => "ENERGY_PRODUCTION",
            Self::ComputeUsage => "COMPUTE_USAGE",
            Self::ReferencePrice => "REFERENCE_PRICE",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnitCode {
    #[serde(rename = "MWh")]
    Mwh,
    #[serde(rename = "gpu_s")]
    GpuS,
}

impl UnitCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Mwh => "MWh",
            Self::GpuS => "gpu_s",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AggregationPolicy {
    Median,
    WeightedMedian,
    QuorumMatch,
    TrimmedMedian,
    CategoricalQuorum,
}

impl AggregationPolicy {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Median => "MEDIAN",
            Self::WeightedMedian => "WEIGHTED_MEDIAN",
            Self::QuorumMatch => "QUORUM_MATCH",
            Self::TrimmedMedian => "TRIMMED_MEDIAN",
            Self::CategoricalQuorum => "CATEGORICAL_QUORUM",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum QualityStatus {
    Pending,
    Verified,
    Conflicted,
    Stale,
    RevokedSource,
    Superseded,
}

impl QualityStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "PENDING",
            Self::Verified => "VERIFIED",
            Self::Conflicted => "CONFLICTED",
            Self::Stale => "STALE",
            Self::RevokedSource => "REVOKED_SOURCE",
            Self::Superseded => "SUPERSEDED",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OracleReject {
    Unregistered,
    Inactive,
    WrongFeed,
    WrongUnit,
    InvalidSignature,
    WrongCryptoSuite,
    StaleObservation,
    DuplicateSequence,
    InsufficientQuorum,
    PayloadOversized,
    WrongNetwork,
    SchemaInvalid,
    ProviderSuspended,
}

impl std::fmt::Display for OracleReject {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl std::error::Error for OracleReject {}

impl OracleReject {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Unregistered => "ORACLE_UNREGISTERED",
            Self::Inactive => "ORACLE_INACTIVE",
            Self::WrongFeed => "ORACLE_WRONG_FEED",
            Self::WrongUnit => "ORACLE_WRONG_UNIT",
            Self::InvalidSignature => "ORACLE_INVALID_SIGNATURE",
            Self::WrongCryptoSuite => "ORACLE_WRONG_CRYPTO_SUITE",
            Self::StaleObservation => "ORACLE_STALE_OBSERVATION",
            Self::DuplicateSequence => "ORACLE_DUPLICATE_SEQUENCE",
            Self::InsufficientQuorum => "ORACLE_INSUFFICIENT_QUORUM",
            Self::PayloadOversized => "ORACLE_PAYLOAD_OVERSIZED",
            Self::WrongNetwork => "ORACLE_WRONG_NETWORK",
            Self::SchemaInvalid => "ORACLE_SCHEMA_INVALID",
            Self::ProviderSuspended => "ORACLE_PROVIDER_SUSPENDED",
        }
    }
}

impl From<OracleReject> for RejectReason {
    fn from(value: OracleReject) -> Self {
        match value {
            OracleReject::WrongNetwork => RejectReason::WrongNetwork,
            OracleReject::PayloadOversized => RejectReason::SizeExceeded,
            OracleReject::WrongCryptoSuite => RejectReason::InvalidCryptoSuite,
            OracleReject::InvalidSignature => RejectReason::InvalidSignature,
            _ => RejectReason::OracleRejected,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleProviderRecord {
    pub oracle_id: String,
    pub controller_actor: String,
    pub oracle_type: OracleType,
    pub public_key: Vec<u8>,
    pub crypto_suite: String,
    pub authorized_feed_types: Vec<FactType>,
    pub status: ProviderStatus,
    pub activation_height: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleFeedDefinition {
    pub feed_id: String,
    pub fact_type: FactType,
    pub measurement_unit: UnitCode,
    pub aggregation_policy: AggregationPolicy,
    pub minimum_sources: u32,
    pub minimum_quorum: u32,
    pub maximum_age_seconds: u64,
    pub max_observation_spread: u64,
    pub trim_count: usize,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleObservation {
    pub observation_id: String,
    pub oracle_id: String,
    pub feed_id: String,
    pub subject: String,
    pub mantissa: u64,
    pub unit: UnitCode,
    pub measurement_start: u64,
    pub measurement_end: u64,
    pub observation_time: u64,
    pub valid_until: u64,
    pub sequence: u64,
    pub weight: u64,
    pub network_id: String,
    pub chain_id: String,
    pub crypto_suite: String,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedEconomicFact {
    pub fact_id: String,
    pub feed_id: String,
    pub subject: String,
    pub aggregated_value: u64,
    pub unit: UnitCode,
    pub source_observation_ids: Vec<String>,
    pub aggregation_policy: AggregationPolicy,
    pub window_start: u64,
    pub window_end: u64,
    pub valid_until: u64,
    pub quality_status: QualityStatus,
    pub finalized_height: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleDispute {
    pub dispute_id: String,
    pub fact_id: Option<String>,
    pub observation_id: Option<String>,
    pub challenger: String,
    pub reason_code: String,
    pub evidence: String,
    pub status: String,
    pub resolution: Option<String>,
    pub governance_reference: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleMetrics {
    pub oracle_observations_received: u64,
    pub oracle_observations_rejected: u64,
    pub oracle_verified_facts: u64,
    pub oracle_conflicts: u64,
    pub oracle_stale_facts: u64,
    pub oracle_quorum_failures: u64,
    pub oracle_provider_status: BTreeMap<String, u64>,
    pub oracle_aggregation_latency: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleEngine {
    pub network_id: String,
    pub chain_id: String,
    pub now_unix: u64,
    pub height: u64,
    pub providers: BTreeMap<String, OracleProviderRecord>,
    pub feeds: BTreeMap<String, OracleFeedDefinition>,
    pub observations: BTreeMap<String, OracleObservation>,
    pub sequences: BTreeMap<String, u64>,
    pub facts: BTreeMap<String, VerifiedEconomicFact>,
    pub disputes: BTreeMap<String, OracleDispute>,
    pub metrics: OracleMetrics,
}

impl Default for OracleEngine {
    fn default() -> Self {
        Self {
            network_id: DEV_NETWORK_ID.to_string(),
            chain_id: DEV_CHAIN_ID.to_string(),
            now_unix: 1_700_000_000,
            height: 1,
            providers: BTreeMap::new(),
            feeds: BTreeMap::new(),
            observations: BTreeMap::new(),
            sequences: BTreeMap::new(),
            facts: BTreeMap::new(),
            disputes: BTreeMap::new(),
            metrics: OracleMetrics {
                oracle_observations_received: 0,
                oracle_observations_rejected: 0,
                oracle_verified_facts: 0,
                oracle_conflicts: 0,
                oracle_stale_facts: 0,
                oracle_quorum_failures: 0,
                oracle_provider_status: BTreeMap::new(),
                oracle_aggregation_latency: 0,
            },
        }
    }
}

impl OracleEngine {
    pub fn load_or_init(dir: impl AsRef<Path>) -> Result<Self, RejectReason> {
        let path = dir.as_ref().join("oracle.json");
        if path.exists() {
            let raw =
                std::fs::read_to_string(path).map_err(|_| RejectReason::PersistenceFailure)?;
            return serde_json::from_str(&raw).map_err(|_| RejectReason::PersistenceFailure);
        }
        Ok(Self::default())
    }

    pub fn persist(&self, dir: impl AsRef<Path>) -> Result<(), RejectReason> {
        let path = dir.as_ref().join("oracle.json");
        let raw =
            serde_json::to_string_pretty(self).map_err(|_| RejectReason::PersistenceFailure)?;
        std::fs::write(path, raw).map_err(|_| RejectReason::PersistenceFailure)
    }

    pub fn register_provider(&mut self, record: OracleProviderRecord) -> Result<(), OracleReject> {
        if self.providers.contains_key(&record.oracle_id) {
            return Err(OracleReject::SchemaInvalid);
        }
        if record.crypto_suite.is_empty() {
            return Err(OracleReject::WrongCryptoSuite);
        }
        self.providers.insert(record.oracle_id.clone(), record);
        Ok(())
    }

    pub fn set_provider_status(
        &mut self,
        oracle_id: &str,
        status: ProviderStatus,
    ) -> Result<(), OracleReject> {
        let provider = self.providers.get_mut(oracle_id).ok_or(OracleReject::Unregistered)?;
        provider.status = status;
        Ok(())
    }

    pub fn register_feed(&mut self, feed: OracleFeedDefinition) -> Result<(), OracleReject> {
        if self.feeds.contains_key(&feed.feed_id) {
            return Err(OracleReject::SchemaInvalid);
        }
        self.feeds.insert(feed.feed_id.clone(), feed);
        Ok(())
    }

    pub fn submit_observation<S: CryptoSuite>(
        &mut self,
        suite: &S,
        observation: OracleObservation,
    ) -> Result<(), OracleReject> {
        self.metrics.oracle_observations_received += 1;
        if let Err(reason) = self.admit(suite, &observation) {
            self.metrics.oracle_observations_rejected += 1;
            return Err(reason);
        }
        let seq_key = format!("{}:{}", observation.oracle_id, observation.feed_id);
        self.sequences.insert(seq_key, observation.sequence);
        self.observations.insert(observation.observation_id.clone(), observation);
        Ok(())
    }

    fn admit<S: CryptoSuite>(
        &self,
        suite: &S,
        observation: &OracleObservation,
    ) -> Result<(), OracleReject> {
        if observation_payload_bytes(observation) > MAX_ORACLE_PAYLOAD_BYTES {
            return Err(OracleReject::PayloadOversized);
        }
        if observation.network_id != self.network_id {
            return Err(OracleReject::WrongNetwork);
        }
        if observation.chain_id != self.chain_id {
            return Err(OracleReject::WrongNetwork);
        }
        let provider =
            self.providers.get(&observation.oracle_id).ok_or(OracleReject::Unregistered)?;
        match provider.status {
            ProviderStatus::Suspended => return Err(OracleReject::ProviderSuspended),
            ProviderStatus::Active => {}
            _ => return Err(OracleReject::Inactive),
        }
        let feed = self.feeds.get(&observation.feed_id).ok_or(OracleReject::WrongFeed)?;
        if feed.status != "ACTIVE" {
            return Err(OracleReject::WrongFeed);
        }
        if !provider.authorized_feed_types.contains(&feed.fact_type) {
            return Err(OracleReject::WrongFeed);
        }
        if observation.unit != feed.measurement_unit {
            return Err(OracleReject::WrongUnit);
        }
        if self.now_unix > observation.valid_until
            || self.now_unix.saturating_sub(observation.observation_time) > feed.maximum_age_seconds
        {
            return Err(OracleReject::StaleObservation);
        }
        let seq_key = format!("{}:{}", observation.oracle_id, observation.feed_id);
        if let Some(last) = self.sequences.get(&seq_key) {
            if observation.sequence <= *last {
                return Err(OracleReject::DuplicateSequence);
            }
        }
        if observation.crypto_suite != provider.crypto_suite
            || observation.crypto_suite != suite.suite_id()
        {
            return Err(OracleReject::WrongCryptoSuite);
        }
        let message = observation_message(observation);
        suite
            .verify(&provider.public_key, &message, &observation.signature)
            .map_err(|_| OracleReject::InvalidSignature)?;
        Ok(())
    }

    pub fn finalize_window(
        &mut self,
        feed_id: &str,
        subject: &str,
        start: u64,
        end: u64,
    ) -> Result<VerifiedEconomicFact, OracleReject> {
        let feed = self.feeds.get(feed_id).cloned().ok_or(OracleReject::WrongFeed)?;
        let rows: Vec<OracleObservation> = self
            .observations
            .values()
            .filter(|row| {
                row.feed_id == feed_id
                    && row.subject == subject
                    && row.measurement_start >= start
                    && row.measurement_end <= end
            })
            .cloned()
            .collect();
        let sources: BTreeSet<&str> = rows.iter().map(|row| row.oracle_id.as_str()).collect();
        if sources.len() < feed.minimum_sources as usize
            || rows.len() < feed.minimum_quorum as usize
        {
            self.metrics.oracle_quorum_failures += 1;
            return Err(OracleReject::InsufficientQuorum);
        }
        let ids: Vec<String> = {
            let mut ids: Vec<String> = rows.iter().map(|row| row.observation_id.clone()).collect();
            ids.sort();
            ids
        };
        let values: Vec<u64> = {
            let mut values: Vec<u64> = rows.iter().map(|row| row.mantissa).collect();
            values.sort_unstable();
            values
        };
        let spread = values.last().copied().unwrap_or(0) - values.first().copied().unwrap_or(0);
        let valid_until = end.saturating_add(feed.maximum_age_seconds);
        if spread > feed.max_observation_spread {
            self.metrics.oracle_conflicts += 1;
            let fact = self.store_fact(VerifiedEconomicFact {
                fact_id: String::new(),
                feed_id: feed.feed_id,
                subject: subject.to_string(),
                aggregated_value: values[0],
                unit: feed.measurement_unit,
                source_observation_ids: ids,
                aggregation_policy: feed.aggregation_policy,
                window_start: start,
                window_end: end,
                valid_until,
                quality_status: QualityStatus::Conflicted,
                finalized_height: self.height,
            });
            return Ok(fact);
        }
        let aggregated = match feed.aggregation_policy {
            AggregationPolicy::WeightedMedian => weighted_median(&rows),
            AggregationPolicy::TrimmedMedian => {
                let trim = feed.trim_count;
                if values.len() <= trim * 2 {
                    self.metrics.oracle_conflicts += 1;
                    let fact = self.store_fact(VerifiedEconomicFact {
                        fact_id: String::new(),
                        feed_id: feed.feed_id,
                        subject: subject.to_string(),
                        aggregated_value: values[0],
                        unit: feed.measurement_unit,
                        source_observation_ids: ids,
                        aggregation_policy: feed.aggregation_policy,
                        window_start: start,
                        window_end: end,
                        valid_until,
                        quality_status: QualityStatus::Conflicted,
                        finalized_height: self.height,
                    });
                    return Ok(fact);
                }
                integer_median(&values[trim..values.len() - trim])
            }
            AggregationPolicy::QuorumMatch => {
                if values.iter().all(|value| *value == values[0]) {
                    values[0]
                } else {
                    self.metrics.oracle_conflicts += 1;
                    let fact = self.store_fact(VerifiedEconomicFact {
                        fact_id: String::new(),
                        feed_id: feed.feed_id,
                        subject: subject.to_string(),
                        aggregated_value: values[0],
                        unit: feed.measurement_unit,
                        source_observation_ids: ids,
                        aggregation_policy: feed.aggregation_policy,
                        window_start: start,
                        window_end: end,
                        valid_until,
                        quality_status: QualityStatus::Conflicted,
                        finalized_height: self.height,
                    });
                    return Ok(fact);
                }
            }
            AggregationPolicy::CategoricalQuorum | AggregationPolicy::Median => {
                integer_median(&values)
            }
        };
        self.metrics.oracle_verified_facts += 1;
        Ok(self.store_fact(VerifiedEconomicFact {
            fact_id: String::new(),
            feed_id: feed.feed_id,
            subject: subject.to_string(),
            aggregated_value: aggregated,
            unit: feed.measurement_unit,
            source_observation_ids: ids,
            aggregation_policy: feed.aggregation_policy,
            window_start: start,
            window_end: end,
            valid_until,
            quality_status: QualityStatus::Verified,
            finalized_height: self.height,
        }))
    }

    fn store_fact(&mut self, mut fact: VerifiedEconomicFact) -> VerifiedEconomicFact {
        for existing in self.facts.values_mut() {
            if existing.feed_id == fact.feed_id
                && existing.subject == fact.subject
                && existing.quality_status == QualityStatus::Verified
            {
                existing.quality_status = QualityStatus::Superseded;
            }
        }
        fact.fact_id = fact_id(&fact);
        self.facts.insert(fact.fact_id.clone(), fact.clone());
        fact
    }

    pub fn refresh_staleness(&mut self) {
        for fact in self.facts.values_mut() {
            if fact.quality_status == QualityStatus::Verified && self.now_unix > fact.valid_until {
                fact.quality_status = QualityStatus::Stale;
                self.metrics.oracle_stale_facts += 1;
            }
        }
    }

    pub fn usable_for_new_economic_use(&mut self, fact_id: &str) -> bool {
        self.refresh_staleness();
        self.facts.get(fact_id).is_some_and(|fact| fact.quality_status == QualityStatus::Verified)
    }

    pub fn quality_report(&mut self) -> BTreeMap<String, u64> {
        self.refresh_staleness();
        let mut counts = BTreeMap::new();
        for status in [
            QualityStatus::Pending,
            QualityStatus::Verified,
            QualityStatus::Conflicted,
            QualityStatus::Stale,
            QualityStatus::RevokedSource,
            QualityStatus::Superseded,
        ] {
            counts.insert(status.as_str().to_string(), 0);
        }
        for fact in self.facts.values() {
            *counts.entry(fact.quality_status.as_str().to_string()).or_insert(0) += 1;
        }
        counts
    }

    pub fn metrics_json(&self) -> serde_json::Value {
        let mut provider_status = BTreeMap::new();
        for provider in self.providers.values() {
            *provider_status.entry(provider.status.as_str().to_string()).or_insert(0) += 1;
        }
        serde_json::json!({
            "oracle_observations_received": self.metrics.oracle_observations_received,
            "oracle_observations_rejected": self.metrics.oracle_observations_rejected,
            "oracle_verified_facts": self.metrics.oracle_verified_facts,
            "oracle_conflicts": self.metrics.oracle_conflicts,
            "oracle_stale_facts": self.metrics.oracle_stale_facts,
            "oracle_quorum_failures": self.metrics.oracle_quorum_failures,
            "oracle_provider_status": provider_status,
            "oracle_aggregation_latency": self.metrics.oracle_aggregation_latency,
        })
    }
}

pub fn integer_median(values: &[u64]) -> u64 {
    let n = values.len();
    let mid = n / 2;
    if n % 2 == 1 {
        values[mid]
    } else {
        (values[mid - 1] + values[mid]) / 2
    }
}

pub fn weighted_median(rows: &[OracleObservation]) -> u64 {
    let mut ordered = rows.to_vec();
    ordered.sort_by_key(|row| (row.mantissa, row.observation_id.clone()));
    let total: u64 = ordered.iter().map(|row| row.weight).sum();
    let threshold = (total + 1) / 2;
    let mut acc = 0;
    for row in &ordered {
        acc += row.weight;
        if acc >= threshold {
            return row.mantissa;
        }
    }
    ordered.last().map(|row| row.mantissa).unwrap_or(0)
}

pub fn observation_message(observation: &OracleObservation) -> Vec<u8> {
    let mut out = Vec::new();
    encode_string(&mut out, DOMAIN_ORACLE);
    encode_string(&mut out, observation.oracle_id.as_str());
    encode_string(&mut out, observation.feed_id.as_str());
    encode_string(&mut out, observation.subject.as_str());
    encode_u64(&mut out, observation.mantissa);
    encode_string(&mut out, observation.unit.as_str());
    encode_u64(&mut out, observation.sequence);
    encode_string(&mut out, observation.network_id.as_str());
    encode_string(&mut out, observation.chain_id.as_str());
    out
}

pub fn observation_id(observation: &OracleObservation) -> String {
    let digest = Sha256::digest(observation_message(observation));
    format!("obs_{}", hex::encode(digest))
}

pub fn fact_id(fact: &VerifiedEconomicFact) -> String {
    let mut out = Vec::new();
    encode_string(&mut out, fact.feed_id.as_str());
    encode_string(&mut out, fact.subject.as_str());
    encode_u64(&mut out, fact.aggregated_value);
    encode_string(&mut out, fact.unit.as_str());
    for id in &fact.source_observation_ids {
        encode_string(&mut out, id);
    }
    encode_u64(&mut out, fact.finalized_height);
    let digest = Sha256::digest(out);
    format!("fact_{}", hex::encode(digest))
}

pub fn observation_payload_bytes(observation: &OracleObservation) -> usize {
    observation.observation_id.len()
        + observation.oracle_id.len()
        + observation.feed_id.len()
        + observation.subject.len()
        + observation.signature.len()
}

pub fn sign_observation<S: CryptoSuite>(
    suite: &S,
    secret: &SigningSecret,
    mut observation: OracleObservation,
) -> Result<OracleObservation, OracleReject> {
    observation.crypto_suite = suite.suite_id().to_string();
    let message = observation_message(&observation);
    observation.signature =
        suite.sign(secret, &message).map_err(|_| OracleReject::InvalidSignature)?;
    observation.observation_id = observation_id(&observation);
    Ok(observation)
}

pub fn development_energy_feed() -> OracleFeedDefinition {
    OracleFeedDefinition {
        feed_id: "feed_energy_production_sim".into(),
        fact_type: FactType::EnergyProduction,
        measurement_unit: UnitCode::Mwh,
        aggregation_policy: AggregationPolicy::Median,
        minimum_sources: 3,
        minimum_quorum: 3,
        maximum_age_seconds: 3600,
        max_observation_spread: 50,
        trim_count: 0,
        status: "ACTIVE".into(),
    }
}

pub fn development_compute_feed() -> OracleFeedDefinition {
    OracleFeedDefinition {
        feed_id: "feed_compute_usage_sim".into(),
        fact_type: FactType::ComputeUsage,
        measurement_unit: UnitCode::GpuS,
        aggregation_policy: AggregationPolicy::Median,
        minimum_sources: 3,
        minimum_quorum: 3,
        maximum_age_seconds: 3600,
        max_observation_spread: 200,
        trim_count: 0,
        status: "ACTIVE".into(),
    }
}

pub fn seed_secret(label: &str) -> SigningSecret {
    let digest = Sha256::digest(format!("SUNREY-ORACLE-DEV-SEED-v1:{label}").as_bytes());
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&digest);
    SigningSecret::from_bytes(bytes)
}

pub fn snapshot_hash(engine: &OracleEngine) -> String {
    let mut hasher = Sha256::new();
    for fact in engine.facts.values() {
        hasher.update(fact.fact_id.as_bytes());
        hasher.update(fact.aggregated_value.to_be_bytes());
        hasher.update(fact.quality_status.as_str().as_bytes());
    }
    hash_to_hex(&hasher.finalize().into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sunrey_crypto::DevEd25519Sha256Suite;

    fn provision(engine: &mut OracleEngine, suite: &DevEd25519Sha256Suite) -> Vec<String> {
        let mut labels = Vec::new();
        for (label, class) in [
            ("energy-a", OracleType::InstitutionalDataProvider),
            ("energy-b", OracleType::RegulatedProvider),
            ("energy-c", OracleType::PublicDataProvider),
        ] {
            let secret = seed_secret(label);
            engine
                .register_provider(OracleProviderRecord {
                    oracle_id: format!("oracle_{label}"),
                    controller_actor: format!("actor_{label}"),
                    oracle_type: class,
                    public_key: secret.public_key(),
                    crypto_suite: suite.suite_id().to_string(),
                    authorized_feed_types: vec![FactType::EnergyProduction, FactType::ComputeUsage],
                    status: ProviderStatus::Active,
                    activation_height: 1,
                })
                .unwrap();
            labels.push(label.to_string());
        }
        engine.register_feed(development_energy_feed()).unwrap();
        labels
    }

    fn observe(
        suite: &DevEd25519Sha256Suite,
        label: &str,
        feed: &str,
        subject: &str,
        value: u64,
        unit: UnitCode,
        sequence: u64,
    ) -> OracleObservation {
        let secret = seed_secret(label);
        sign_observation(
            suite,
            &secret,
            OracleObservation {
                observation_id: String::new(),
                oracle_id: format!("oracle_{label}"),
                feed_id: feed.to_string(),
                subject: subject.to_string(),
                mantissa: value,
                unit,
                measurement_start: 1_700_000_000,
                measurement_end: 1_700_000_060,
                observation_time: 1_700_000_030,
                valid_until: 1_700_003_600,
                sequence,
                weight: 1,
                network_id: DEV_NETWORK_ID.to_string(),
                chain_id: DEV_CHAIN_ID.to_string(),
                crypto_suite: String::new(),
                signature: Vec::new(),
            },
        )
        .unwrap()
    }

    #[test]
    fn unregistered_oracle_rejected() {
        let suite = DevEd25519Sha256Suite;
        let mut engine = OracleEngine::default();
        engine.register_feed(development_energy_feed()).unwrap();
        let observation = observe(
            &suite,
            "energy-a",
            "feed_energy_production_sim",
            "plant",
            100,
            UnitCode::Mwh,
            1,
        );
        assert_eq!(
            engine.submit_observation(&suite, observation).unwrap_err(),
            OracleReject::Unregistered
        );
    }

    #[test]
    fn wrong_unit_and_suite_and_sequence_rejected() {
        let suite = DevEd25519Sha256Suite;
        let mut engine = OracleEngine::default();
        let labels = provision(&mut engine, &suite);
        let wrong_unit = observe(
            &suite,
            &labels[0],
            "feed_energy_production_sim",
            "plant",
            100,
            UnitCode::GpuS,
            1,
        );
        assert_eq!(
            engine.submit_observation(&suite, wrong_unit).unwrap_err(),
            OracleReject::WrongUnit
        );
        let ok = observe(
            &suite,
            &labels[0],
            "feed_energy_production_sim",
            "plant",
            100,
            UnitCode::Mwh,
            1,
        );
        engine.submit_observation(&suite, ok.clone()).unwrap();
        let dup = observe(
            &suite,
            &labels[0],
            "feed_energy_production_sim",
            "other",
            101,
            UnitCode::Mwh,
            1,
        );
        assert_eq!(
            engine.submit_observation(&suite, dup).unwrap_err(),
            OracleReject::DuplicateSequence
        );
        let mut bad_suite = ok;
        bad_suite.sequence = 2;
        bad_suite.crypto_suite = "unknown-suite".into();
        assert_eq!(
            engine.submit_observation(&suite, bad_suite).unwrap_err(),
            OracleReject::WrongCryptoSuite
        );
    }

    #[test]
    fn median_and_weighted_median_are_deterministic() {
        assert_eq!(integer_median(&[100, 102, 104]), 102);
        assert_eq!(integer_median(&[1, 2, 3, 4]), 2);
        let rows = [
            OracleObservation {
                observation_id: "a".into(),
                oracle_id: "a".into(),
                feed_id: "f".into(),
                subject: "s".into(),
                mantissa: 10,
                unit: UnitCode::Mwh,
                measurement_start: 0,
                measurement_end: 1,
                observation_time: 1,
                valid_until: 2,
                sequence: 1,
                weight: 1,
                network_id: DEV_NETWORK_ID.into(),
                chain_id: DEV_CHAIN_ID.into(),
                crypto_suite: String::new(),
                signature: Vec::new(),
            },
            OracleObservation {
                observation_id: "b".into(),
                oracle_id: "b".into(),
                feed_id: "f".into(),
                subject: "s".into(),
                mantissa: 30,
                unit: UnitCode::Mwh,
                measurement_start: 0,
                measurement_end: 1,
                observation_time: 1,
                valid_until: 2,
                sequence: 1,
                weight: 5,
                network_id: DEV_NETWORK_ID.into(),
                chain_id: DEV_CHAIN_ID.into(),
                crypto_suite: String::new(),
                signature: Vec::new(),
            },
        ];
        assert_eq!(weighted_median(&rows), 30);
    }

    #[test]
    fn four_validators_agree_then_stale_and_conflict() {
        let suite = DevEd25519Sha256Suite;
        let mut engines = [
            OracleEngine::default(),
            OracleEngine::default(),
            OracleEngine::default(),
            OracleEngine::default(),
        ];
        let mut fact_ids = Vec::new();
        for engine in &mut engines {
            let labels = provision(engine, &suite);
            for (label, value) in labels.iter().zip([100u64, 102, 104]) {
                let observation = observe(
                    &suite,
                    label,
                    "feed_energy_production_sim",
                    "plant_sim_1",
                    value,
                    UnitCode::Mwh,
                    1,
                );
                engine.submit_observation(&suite, observation).unwrap();
            }
            let fact = engine
                .finalize_window(
                    "feed_energy_production_sim",
                    "plant_sim_1",
                    1_700_000_000,
                    1_700_000_060,
                )
                .unwrap();
            assert_eq!(fact.aggregated_value, 102);
            assert_eq!(fact.quality_status, QualityStatus::Verified);
            fact_ids.push(fact.fact_id);
        }
        assert!(fact_ids.iter().all(|id| id == &fact_ids[0]));
        for engine in &mut engines {
            engine.now_unix = 1_700_010_000;
            engine.refresh_staleness();
            assert!(!engine.usable_for_new_economic_use(&fact_ids[0]));
            assert_eq!(engine.facts[&fact_ids[0]].quality_status, QualityStatus::Stale);
        }
        let mut conflict_ids = Vec::new();
        for engine in &mut engines {
            engine.now_unix = 1_700_000_000;
            for (label, value) in ["energy-a", "energy-b", "energy-c"].iter().zip([10u64, 500, 12])
            {
                let observation = observe(
                    &suite,
                    label,
                    "feed_energy_production_sim",
                    "plant_conflict",
                    value,
                    UnitCode::Mwh,
                    2,
                );
                engine.submit_observation(&suite, observation).unwrap();
            }
            let fact = engine
                .finalize_window(
                    "feed_energy_production_sim",
                    "plant_conflict",
                    1_700_000_000,
                    1_700_000_060,
                )
                .unwrap();
            assert_eq!(fact.quality_status, QualityStatus::Conflicted);
            conflict_ids.push(fact.fact_id);
        }
        assert!(conflict_ids.iter().all(|id| id == &conflict_ids[0]));
    }

    #[test]
    fn suspension_affects_future_only() {
        let suite = DevEd25519Sha256Suite;
        let mut engine = OracleEngine::default();
        let labels = provision(&mut engine, &suite);
        let first = observe(
            &suite,
            &labels[0],
            "feed_energy_production_sim",
            "plant",
            100,
            UnitCode::Mwh,
            1,
        );
        engine.submit_observation(&suite, first.clone()).unwrap();
        engine
            .set_provider_status(&format!("oracle_{}", labels[0]), ProviderStatus::Suspended)
            .unwrap();
        let second = observe(
            &suite,
            &labels[0],
            "feed_energy_production_sim",
            "later",
            101,
            UnitCode::Mwh,
            2,
        );
        assert_eq!(
            engine.submit_observation(&suite, second).unwrap_err(),
            OracleReject::ProviderSuspended
        );
        assert!(engine.observations.contains_key(&first.observation_id));
    }
}
