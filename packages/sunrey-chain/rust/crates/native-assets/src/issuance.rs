use serde::{Deserialize, Serialize};
use sunrey_protocol::{decode_string, decode_u64, encode_string, encode_u64};

use crate::crypto_policy::{AssetCrypto, CryptoPolicy};
use crate::error::AssetError;
use crate::quantity::AssetQuantity;
use crate::registry::NativeAssetId;

pub const ISSUANCE_AUTH_TAG: &str = "IssuanceAuthorizationV1";
pub const SUNREY_ISSUANCE_POLICY: &str = "sunrey.issuance.sunrey_coin.v1";
pub const MOONREY_ISSUANCE_POLICY: &str = "sunrey.issuance.moonrey_coin.v1";
pub const DEVELOPMENT_FAUCET_POLICY: &str = "sunrey.issuance.development_faucet.v1";
pub const DEV_FAUCET_ISSUER: &str = "dev.faucet.authority";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IssuanceAuthorization {
    pub authorization_id: String,
    pub asset_id: NativeAssetId,
    pub recipient: String,
    pub quantity: u128,
    pub issuance_policy: String,
    pub proof_reference: String,
    pub governance_policy_reference: String,
    pub expiration_height: u64,
    pub issuer: String,
    pub suite_id: String,
    pub algorithm_id: String,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
    pub network_id: String,
    pub chain_id: String,
}

impl IssuanceAuthorization {
    pub fn unsigned_bytes(&self) -> Vec<u8> {
        let mut out = Vec::new();
        encode_string(&mut out, ISSUANCE_AUTH_TAG);
        encode_string(&mut out, &self.authorization_id);
        encode_string(&mut out, self.asset_id.as_str());
        encode_string(&mut out, &self.recipient);
        sunrey_protocol::encode_u128(&mut out, self.quantity);
        encode_string(&mut out, &self.issuance_policy);
        encode_string(&mut out, &self.proof_reference);
        encode_string(&mut out, &self.governance_policy_reference);
        encode_u64(&mut out, self.expiration_height);
        encode_string(&mut out, &self.issuer);
        encode_string(&mut out, &self.network_id);
        encode_string(&mut out, &self.chain_id);
        out
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = self.unsigned_bytes();
        encode_string(&mut out, &self.suite_id);
        encode_string(&mut out, &self.algorithm_id);
        sunrey_protocol::encode_bytes(&mut out, &self.public_key);
        sunrey_protocol::encode_bytes(&mut out, &self.signature);
        out
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, AssetError> {
        let mut input = bytes;
        let tag = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        if tag != ISSUANCE_AUTH_TAG {
            return Err(AssetError::SchemaInvalid);
        }
        let authorization_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let asset_id = NativeAssetId::parse(
            &decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?,
        )?;
        let recipient = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let quantity =
            sunrey_protocol::decode_u128(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let issuance_policy = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let proof_reference = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let governance_policy_reference =
            decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let expiration_height = decode_u64(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let issuer = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let network_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let chain_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let suite_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let algorithm_id = decode_string(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let public_key =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        let signature =
            sunrey_protocol::decode_bytes(&mut input).map_err(|_| AssetError::DecodeFailed)?;
        if !input.is_empty() {
            return Err(AssetError::SchemaInvalid);
        }
        Ok(Self {
            authorization_id,
            asset_id,
            recipient,
            quantity,
            issuance_policy,
            proof_reference,
            governance_policy_reference,
            expiration_height,
            issuer,
            suite_id,
            algorithm_id,
            public_key,
            signature,
            network_id,
            chain_id,
        })
    }

    pub fn quantity(&self) -> Result<AssetQuantity, AssetError> {
        AssetQuantity::new(self.asset_id, self.quantity)
    }
}

pub struct IssuanceVerifyCtx<'a> {
    pub crypto: &'a dyn AssetCrypto,
    pub policy: &'a CryptoPolicy,
    pub height: u64,
    pub network_id: &'a str,
    pub chain_id: &'a str,
}

/// Versioned SunRey native issuance-authority interface.
/// Does not replace the application human-information contribution model.
pub trait SunReyNativeIssuanceAuthority {
    fn verify(
        &self,
        authorization: &IssuanceAuthorization,
        ctx: &IssuanceVerifyCtx<'_>,
    ) -> Result<(), AssetError>;
}

/// MoonRey issuance requires a cryptographically verifiable economic
/// authorization artifact. Production economic logic is Chunk 44.
pub trait MoonReyIssuanceAuthorityPort {
    fn verify_economic_authorization(
        &self,
        authorization: &IssuanceAuthorization,
        artifact: &EconomicAuthorizationArtifact,
        ctx: &IssuanceVerifyCtx<'_>,
    ) -> Result<(), AssetError>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EconomicAuthorizationArtifact {
    pub artifact_id: String,
    pub schema_id: String,
    pub proof_reference: String,
    pub labeled_test: bool,
}

#[derive(Debug, Default, Clone)]
pub struct DevelopmentSunReyIssuanceAuthority;

impl SunReyNativeIssuanceAuthority for DevelopmentSunReyIssuanceAuthority {
    fn verify(
        &self,
        authorization: &IssuanceAuthorization,
        ctx: &IssuanceVerifyCtx<'_>,
    ) -> Result<(), AssetError> {
        verify_common(authorization, ctx)?;
        if authorization.asset_id != NativeAssetId::SunReyCoin {
            return Err(AssetError::UnauthorizedIssuance);
        }
        if authorization.issuance_policy != SUNREY_ISSUANCE_POLICY
            && authorization.issuance_policy != DEVELOPMENT_FAUCET_POLICY
        {
            return Err(AssetError::UnauthorizedIssuance);
        }
        Ok(())
    }
}

#[derive(Debug, Default, Clone)]
pub struct DevelopmentMoonReyIssuanceAuthority;

impl MoonReyIssuanceAuthorityPort for DevelopmentMoonReyIssuanceAuthority {
    fn verify_economic_authorization(
        &self,
        authorization: &IssuanceAuthorization,
        artifact: &EconomicAuthorizationArtifact,
        ctx: &IssuanceVerifyCtx<'_>,
    ) -> Result<(), AssetError> {
        verify_common(authorization, ctx)?;
        if authorization.asset_id != NativeAssetId::MoonReyCoin {
            return Err(AssetError::UnauthorizedIssuance);
        }
        if !artifact.labeled_test && authorization.issuance_policy != DEVELOPMENT_FAUCET_POLICY {
            return Err(AssetError::UnauthorizedIssuance);
        }
        if authorization.proof_reference != artifact.proof_reference {
            return Err(AssetError::UnauthorizedIssuance);
        }
        Ok(())
    }
}

fn verify_common(
    authorization: &IssuanceAuthorization,
    ctx: &IssuanceVerifyCtx<'_>,
) -> Result<(), AssetError> {
    if authorization.network_id != ctx.network_id {
        return Err(AssetError::WrongNetwork);
    }
    if authorization.chain_id != ctx.chain_id {
        return Err(AssetError::WrongChain);
    }
    if authorization.expiration_height != 0 && ctx.height > authorization.expiration_height {
        return Err(AssetError::AuthorizationExpired);
    }
    if authorization.quantity == 0 {
        return Err(AssetError::QuantityZero);
    }
    ctx.policy.matches(&authorization.suite_id, &authorization.algorithm_id)?;
    if authorization.suite_id != ctx.crypto.suite_id()
        || authorization.algorithm_id != ctx.crypto.algorithm_id()
    {
        return Err(AssetError::InvalidCryptoSuite);
    }
    ctx.crypto.verify(
        &authorization.public_key,
        &authorization.unsigned_bytes(),
        &authorization.signature,
    )
}
