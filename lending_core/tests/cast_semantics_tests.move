#[test_only]
module lending_core::cast_semantics_tests {
    #[test]
    fun test_u256_to_u64_in_range() {
        let max_u64_as_u256: u256 = 18446744073709551615u256; // 2^64 - 1
        let x: u64 = max_u64_as_u256 as u64;
        assert!(x == 18446744073709551615u64, 1);
    }

    #[test]
    fun test_u256_to_u64_overflow_behavior() {
        let overflow: u256 = 18446744073709551616u256; // 2^64
        let y: u64 = overflow as u64; // if truncates, becomes 0; if checked, may abort elsewhere
        assert!(y == 0, 2);
    }
}

