use serde::{Deserialize, Serialize};

use crate::error::InteropError;
use crate::types::ActorKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InteropGovernanceAction {
    RegisterExternalChain,
    ActivateExternalChain,
    SuspendExternalChain,
    SetClientType,
    ActivateConnection,
    SetChannelCapabilities,
    SetAssetAllowlist,
    SetProofSystemVersion,
    UpgradeClient,
    SuspendClient,
}

impl InteropGovernanceAction {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::RegisterExternalChain => "REGISTER_EXTERNAL_CHAIN",
            Self::ActivateExternalChain => "ACTIVATE_EXTERNAL_CHAIN",
            Self::SuspendExternalChain => "SUSPEND_EXTERNAL_CHAIN",
            Self::SetClientType => "SET_CLIENT_TYPE",
            Self::ActivateConnection => "ACTIVATE_CONNECTION",
            Self::SetChannelCapabilities => "SET_CHANNEL_CAPABILITIES",
            Self::SetAssetAllowlist => "SET_ASSET_ALLOWLIST",
            Self::SetProofSystemVersion => "SET_PROOF_SYSTEM_VERSION",
            Self::UpgradeClient => "UPGRADE_CLIENT",
            Self::SuspendClient => "SUSPEND_CLIENT",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceAuthorization {
    pub actor_id: String,
    pub actor_kind: ActorKind,
    pub action: InteropGovernanceAction,
    pub target: String,
}

impl GovernanceAuthorization {
    pub fn require(&self, action: InteropGovernanceAction) -> Result<(), InteropError> {
        if self.action != action {
            return Err(InteropError::GovernanceRequired);
        }
        self.actor_kind.may_activate_chain()
    }
}

pub fn reject_ai(actor: ActorKind) -> Result<(), InteropError> {
    if actor == ActorKind::AiPreparer {
        Err(InteropError::AiCannotActivate)
    } else {
        Ok(())
    }
}
