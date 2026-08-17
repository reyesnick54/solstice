//! Operator topology helpers. This is not a second consensus engine
//! or validator registry.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SentryTopology {
    pub validator_id: String,
    pub sentry_ids: Vec<String>,
}

impl SentryTopology {
    pub fn validate(&self) -> Result<(), String> {
        if self.sentry_ids.len() < 2 {
            return Err("at least two sentries required".into());
        }
        if self.sentry_ids.iter().any(|id| id == &self.validator_id) {
            return Err("sentry cannot share validator identity".into());
        }
        Ok(())
    }

    pub fn sentry_can_sign(&self) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_two_sentries_and_forbids_sentry_signing() {
        let too_few = SentryTopology {
            validator_id: "val_a".into(),
            sentry_ids: vec!["s1".into()],
        };
        assert!(too_few.validate().is_err());
        let topo = SentryTopology {
            validator_id: "val_a".into(),
            sentry_ids: vec!["s1".into(), "s2".into()],
        };
        assert!(topo.validate().is_ok());
        assert!(!topo.sentry_can_sign());
    }
}
