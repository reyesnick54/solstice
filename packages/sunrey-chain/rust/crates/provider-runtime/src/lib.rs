//! Executable provider-runtime invariants.
//!
//! Technical connectivity is not approval. Consensus has no general
//! provider egress. Software PQ support cannot claim hardware PQ.

use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ProviderRuntimeError {
    #[error("workload privilege denied")]
    WorkloadPrivilegeDenied,
    #[error("consensus has no general provider egress")]
    ConsensusEgressForbidden,
    #[error("financial instruction left SUBMISSION_UNKNOWN")]
    SubmissionUnknown,
    #[error("replayed webhook rejected")]
    WebhookReplay,
    #[error("PRODUCTION_AUTHORIZED requires evidence and human authority")]
    ProductionNotAuthorized,
    #[error("hardware PQ support cannot be inferred")]
    HardwarePqNotInferred,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeMode {
    LocalSimulation,
    Sandbox,
    IntegrationTest,
    ProductionCandidateDisabled,
    ProductionAuthorized,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PqcProbe {
    ClassicalSupported,
    MlDsaSupported,
    HybridPatternSupported,
    HardwarePqSupported,
    Unknown,
}

pub fn authorize_workload(workload: &str, domain: &str) -> Result<(), ProviderRuntimeError> {
    if workload == "consensus_execution" {
        return Err(ProviderRuntimeError::ConsensusEgressForbidden);
    }
    if workload == "oracle_collector" && domain == "HSM" {
        return Err(ProviderRuntimeError::WorkloadPrivilegeDenied);
    }
    if workload == "explorer" && domain == "IDENTITY_KYC" {
        return Err(ProviderRuntimeError::WorkloadPrivilegeDenied);
    }
    Ok(())
}

pub fn authorize_production(
    evidence: bool,
    human: bool,
) -> Result<RuntimeMode, ProviderRuntimeError> {
    if !evidence || !human {
        return Err(ProviderRuntimeError::ProductionNotAuthorized);
    }
    Ok(RuntimeMode::ProductionAuthorized)
}

pub fn probe_hardware_pq(hardware_evidence: bool) -> Result<PqcProbe, ProviderRuntimeError> {
    if hardware_evidence {
        Ok(PqcProbe::HardwarePqSupported)
    } else {
        Ok(PqcProbe::Unknown)
    }
}

pub fn reject_software_hardware_claim(
    software_pq: bool,
    hardware_evidence: bool,
) -> Result<(), ProviderRuntimeError> {
    if software_pq && !hardware_evidence {
        return Err(ProviderRuntimeError::HardwarePqNotInferred);
    }
    Ok(())
}

pub fn reject_financial_retry(last_state: &str) -> Result<(), ProviderRuntimeError> {
    if last_state == "SUBMITTED" || last_state == "SUBMISSION_UNKNOWN" {
        return Err(ProviderRuntimeError::SubmissionUnknown);
    }
    Ok(())
}

pub fn reject_replay(seen: bool) -> Result<(), ProviderRuntimeError> {
    if seen {
        return Err(ProviderRuntimeError::WebhookReplay);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn least_privilege_and_approval_boundaries() {
        assert_eq!(
            authorize_workload("oracle_collector", "HSM"),
            Err(ProviderRuntimeError::WorkloadPrivilegeDenied)
        );
        assert_eq!(
            authorize_workload("explorer", "IDENTITY_KYC"),
            Err(ProviderRuntimeError::WorkloadPrivilegeDenied)
        );
        assert_eq!(
            authorize_workload("consensus_execution", "ORACLE_DATA_SOURCE"),
            Err(ProviderRuntimeError::ConsensusEgressForbidden)
        );
        assert_eq!(
            authorize_production(false, false),
            Err(ProviderRuntimeError::ProductionNotAuthorized)
        );
        assert_eq!(probe_hardware_pq(false), Ok(PqcProbe::Unknown));
        assert_eq!(
            reject_software_hardware_claim(true, false),
            Err(ProviderRuntimeError::HardwarePqNotInferred)
        );
        assert_eq!(
            reject_financial_retry("SUBMISSION_UNKNOWN"),
            Err(ProviderRuntimeError::SubmissionUnknown)
        );
        assert_eq!(reject_replay(true), Err(ProviderRuntimeError::WebhookReplay));
    }
}
