use crate::error::ConsensusError;

/// Strictly more than two-thirds of `total`.
///
/// `power > ⌊2 · total / 3⌋` using checked integer arithmetic only.
pub fn exceeds_two_thirds(power: u64, total: u64) -> Result<bool, ConsensusError> {
    if total == 0 {
        return Err(ConsensusError::EmptyValidatorSet);
    }
    let two_thirds = total.checked_mul(2).ok_or(ConsensusError::Overflow)? / 3;
    Ok(power > two_thirds)
}

/// Strictly more than one-third of `total`.
pub fn exceeds_one_third(power: u64, total: u64) -> Result<bool, ConsensusError> {
    if total == 0 {
        return Err(ConsensusError::EmptyValidatorSet);
    }
    Ok(power > total / 3)
}

/// Minimum power that satisfies `> 2/3` of `total`: `⌊2n/3⌋ + 1`.
pub fn two_thirds_threshold(total: u64) -> Result<u64, ConsensusError> {
    if total == 0 {
        return Err(ConsensusError::EmptyValidatorSet);
    }
    let two_thirds = total.checked_mul(2).ok_or(ConsensusError::Overflow)? / 3;
    two_thirds.checked_add(1).ok_or(ConsensusError::Overflow)
}

/// Maximum Byzantine power still compatible with `f < 1/3`: `⌊(total − 1) / 3⌋`.
pub fn max_byzantine_power(total: u64) -> Result<u64, ConsensusError> {
    if total == 0 {
        return Err(ConsensusError::EmptyValidatorSet);
    }
    Ok(total.saturating_sub(1) / 3)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_equal_validators_need_three() {
        assert_eq!(two_thirds_threshold(4).unwrap(), 3);
        assert!(!exceeds_two_thirds(2, 4).unwrap());
        assert!(exceeds_two_thirds(3, 4).unwrap());
        assert_eq!(max_byzantine_power(4).unwrap(), 1);
    }

    #[test]
    fn exactly_one_third_is_not_strict() {
        assert!(!exceeds_one_third(1, 3).unwrap());
        assert!(!exceeds_two_thirds(2, 3).unwrap());
        assert!(exceeds_two_thirds(3, 3).unwrap());
        assert!(!exceeds_one_third(100, 300).unwrap());
        assert!(!exceeds_two_thirds(200, 300).unwrap());
        assert!(exceeds_two_thirds(201, 300).unwrap());
    }

    #[test]
    fn overflow_is_reported() {
        assert!(exceeds_two_thirds(u64::MAX, u64::MAX).is_err());
    }
}
