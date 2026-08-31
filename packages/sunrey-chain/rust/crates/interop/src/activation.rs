//! Production interoperability activation gate.
//!
//! Production interop remains FAIL-CLOSED. URLs, credentials, NODE_ENV, or
//! relayer startup must not enable production interop.

use serde::{Deserialize, Serialize};

use crate::error::InteropError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InteropActivationState {
    Disabled,
    DevelopmentOnly,
    GovernanceAuthorized,
    ProductionActive,
}

impl InteropActivationState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Disabled => "DISABLED",
            Self::DevelopmentOnly => "DEVELOPMENT_ONLY",
            Self::GovernanceAuthorized => "GOVERNANCE_AUTHORIZED",
            Self::ProductionActive => "PRODUCTION_ACTIVE",
        }
    }

    pub fn may_execute_production(self) -> bool {
        self == Self::ProductionActive
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InteropActivationGate {
    pub state: InteropActivationState,
    pub environment: String,
    pub live_flags: bool,
    pub governance_approval_id: Option<String>,
    pub qualification_complete: bool,
    pub counsel_review: String,
}

impl Default for InteropActivationGate {
    fn default() -> Self {
        Self {
            state: InteropActivationState::Disabled,
            environment: "simulation".into(),
            live_flags: false,
            governance_approval_id: None,
            qualification_complete: false,
            counsel_review: "RESEARCH_REQUIRED".into(),
        }
    }
}

impl InteropActivationGate {
    pub fn fail_closed_default() -> Self {
        Self::default()
    }

    pub fn require_development(&self) -> Result<(), InteropError> {
        match self.state {
            InteropActivationState::DevelopmentOnly
            | InteropActivationState::GovernanceAuthorized
            | InteropActivationState::ProductionActive => Ok(()),
            InteropActivationState::Disabled => Err(InteropError::ProductionInteropDisabled),
        }
    }

    pub fn require_production(&self) -> Result<(), InteropError> {
        if self.live_flags && self.state != InteropActivationState::ProductionActive {
            return Err(InteropError::ProductionInteropDisabled);
        }
        if self.environment != "simulation" && !self.qualification_complete {
            return Err(InteropError::ProductionInteropDisabled);
        }
        if self.state != InteropActivationState::ProductionActive {
            return Err(InteropError::ProductionInteropDisabled);
        }
        if self.counsel_review != "CONFIRMED_BY_COUNSEL" {
            return Err(InteropError::ProductionInteropDisabled);
        }
        Ok(())
    }

    /// Relayer or watcher startup must not flip activation.
    pub fn relayer_started_must_not_activate(&mut self) {
        // explicit no-op: relayer start does not change state
    }

    pub fn url_present_must_not_activate(&mut self, _url: &str) {
        // explicit no-op
    }

    pub fn credential_present_must_not_activate(&mut self, _credential_ref: &str) {
        // explicit no-op
    }

    pub fn node_env_production_must_not_activate(&mut self, _node_env: &str) {
        // explicit no-op
    }
}
