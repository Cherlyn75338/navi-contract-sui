module harness::harness {
    use std::option;

    /// Placeholder types simulating price oracle with explicit decimals
    struct Price has copy, drop { value: u64, decimals: u8 }

    /// Compute value = amount * price with naive mismatch (no normalization)
    public fun naive_value(amount_normal_units: u64, p: Price): u256 {
        // Simulate mismatch: treat price.value as if aligned
        (amount_normal_units as u256) * (p.value as u256)
    }

    /// Compute normalized value aligning both to target (e.g., 10^9)
    public fun normalized_value(amount: u64, coin_decimals: u8, p: Price, target: u8): u256 {
        let mut_amt = amount as u256;
        let mut_price = p.value as u256;
        if (coin_decimals > target) {
            mut_amt = mut_amt / pow10_u256((coin_decimals - target) as u64);
        } else if (coin_decimals < target) {
            mut_amt = mut_amt * pow10_u256((target - coin_decimals) as u64);
        };
        if (p.decimals > target) {
            mut_price = mut_price / pow10_u256((p.decimals - target) as u64);
        } else if (p.decimals < target) {
            mut_price = mut_price * pow10_u256((target - p.decimals) as u64);
        };
        mut_amt * mut_price
    }

    fun pow10_u256(exp: u64): u256 {
        let mut acc: u256 = 1;
        let mut i = 0;
        while (i < exp) {
            acc = acc * 10;
            i = i + 1;
        };
        acc
    }
}

