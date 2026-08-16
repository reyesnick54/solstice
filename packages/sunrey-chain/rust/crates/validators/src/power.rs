pub fn total_power(powers: &[u64]) -> Result<u128, &'static str> {
    let mut total: u128 = 0;
    for power in powers {
        total = total.checked_add(u128::from(*power)).ok_or("voting power overflow")?;
    }
    Ok(total)
}

pub fn one_third_power(total: u128) -> u128 {
    total / 3
}

pub fn two_thirds_power(total: u128) -> u128 {
    total.saturating_mul(2) / 3
}

pub fn has_one_third_plus(signed: u128, total: u128) -> Result<bool, &'static str> {
    let left = signed.checked_mul(3).ok_or("signed power overflow")?;
    Ok(left > total)
}

pub fn has_two_thirds_plus(signed: u128, total: u128) -> Result<bool, &'static str> {
    let left = signed.checked_mul(3).ok_or("signed power overflow")?;
    let right = total.checked_mul(2).ok_or("total power overflow")?;
    Ok(left > right)
}
