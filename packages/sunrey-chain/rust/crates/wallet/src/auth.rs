//! Account authorization policies and M-of-N verification.

use std::collections::BTreeSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthPolicy {
    SingleSignature,
    MOfN,
    RoleBased,
    OwnerPlusRecovery,
    InstitutionalPolicy,
    MachineMandate,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AccountPolicy {
    pub kind: AuthPolicy,
    pub threshold: u32,
    pub authorized_key_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PresentedSignature {
    pub key_id: String,
    pub authorized: bool,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum AuthError {
    #[error("duplicate signer")]
    DuplicateSigner,
    #[error("unauthorized signer")]
    UnauthorizedSigner,
    #[error("insufficient M-of-N")]
    InsufficientMOfN,
}

pub fn authorize(
    policy: &AccountPolicy,
    signatures: &[PresentedSignature],
) -> Result<(), AuthError> {
    let mut seen = BTreeSet::new();
    let mut valid = 0u32;
    for signature in signatures {
        if !seen.insert(signature.key_id.as_str()) {
            return Err(AuthError::DuplicateSigner);
        }
        if !signature.authorized
            || !policy.authorized_key_ids.iter().any(|id| id == &signature.key_id)
        {
            return Err(AuthError::UnauthorizedSigner);
        }
        valid += 1;
    }
    if valid < policy.threshold {
        return Err(AuthError::InsufficientMOfN);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy() -> AccountPolicy {
        AccountPolicy {
            kind: AuthPolicy::MOfN,
            threshold: 2,
            authorized_key_ids: vec!["a".into(), "b".into(), "c".into()],
        }
    }

    #[test]
    fn multi_auth_rules() {
        let p = policy();
        assert_eq!(
            authorize(&p, &[PresentedSignature { key_id: "a".into(), authorized: true }]),
            Err(AuthError::InsufficientMOfN)
        );
        assert_eq!(
            authorize(
                &p,
                &[
                    PresentedSignature { key_id: "a".into(), authorized: true },
                    PresentedSignature { key_id: "a".into(), authorized: true }
                ]
            ),
            Err(AuthError::DuplicateSigner)
        );
        assert_eq!(
            authorize(
                &p,
                &[
                    PresentedSignature { key_id: "a".into(), authorized: true },
                    PresentedSignature { key_id: "intruder".into(), authorized: false }
                ]
            ),
            Err(AuthError::UnauthorizedSigner)
        );
        assert!(authorize(
            &p,
            &[
                PresentedSignature { key_id: "a".into(), authorized: true },
                PresentedSignature { key_id: "b".into(), authorized: true }
            ]
        )
        .is_ok());
    }
}
