//! Chunk 68 production-candidate oracle onboarding helpers.
//!
//! Off-chain collection stays outside consensus. This module never
//! performs HTTP. Missing commercial evidence is never confirmed.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OnboardingStatus {
    Draft,
    TechnicallyValidated,
    TestnetActive,
    ProductionCandidate,
    Suspended,
    Revoked,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceRef {
    pub provider_id: String,
    pub controller_id: String,
    pub upstream_org: String,
}

pub fn independent_controller_count(sources: &[SourceRef]) -> usize {
    let mut seen = std::collections::BTreeSet::new();
    for source in sources {
        seen.insert(source.controller_id.as_str());
    }
    seen.len()
}

pub fn production_eligibility_requires_evidence(
    status: OnboardingStatus,
    agreement_confirmed: bool,
    security_reviewed: bool,
    technical_ref_present: bool,
) -> bool {
    status == OnboardingStatus::ProductionCandidate
        && agreement_confirmed
        && security_reviewed
        && technical_ref_present
}

pub fn reject_float_numeric(value: &str) -> bool {
    value.contains('.')
        || value.to_ascii_lowercase().contains('e')
        || value.parse::<i128>().is_err()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_controller_is_one_independent_source() {
        let sources = [
            SourceRef {
                provider_id: "oracle_a".into(),
                controller_id: "ctl_1".into(),
                upstream_org: "org_1".into(),
            },
            SourceRef {
                provider_id: "oracle_b".into(),
                controller_id: "ctl_1".into(),
                upstream_org: "org_1".into(),
            },
        ];
        assert_eq!(independent_controller_count(&sources), 1);
    }

    #[test]
    fn production_eligibility_is_not_automatic() {
        assert!(!production_eligibility_requires_evidence(
            OnboardingStatus::TestnetActive,
            true,
            true,
            true
        ));
        assert!(production_eligibility_requires_evidence(
            OnboardingStatus::ProductionCandidate,
            true,
            true,
            true
        ));
        assert!(!production_eligibility_requires_evidence(
            OnboardingStatus::ProductionCandidate,
            false,
            true,
            true
        ));
    }

    #[test]
    fn floats_are_rejected() {
        assert!(reject_float_numeric("1.2"));
        assert!(reject_float_numeric("1e3"));
        assert!(!reject_float_numeric("100"));
    }

    #[test]
    fn consensus_source_has_no_http_client() {
        let source = include_str!("production.rs");
        let socket = ["std", "::", "net"].concat();
        let client = ["hyper", "::"].concat();
        assert!(!source.contains(&socket), "production helpers must not open sockets");
        assert!(!source.contains(&client), "production helpers must not use HTTP clients");
    }
}
