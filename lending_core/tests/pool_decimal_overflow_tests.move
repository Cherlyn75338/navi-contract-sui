#[test_only]
module lending_core::pool_decimal_overflow_tests {
    use lending_core::pool;

    #[test]
    fun test_convert_amount_boundary_no_overflow() {
        // 18 * 10^18 == 18_000_000_000_000_000_000 fits in u64
        assert!(pool::convert_amount(18, 0, 18) == 18_000_000_000_000_000_000, 1);
    }

    #[test, expected_failure]
    fun test_convert_amount_overflow_increase_decimals() {
        // 19 * 10^18 overflows u64
        let _ = pool::convert_amount(19, 0, 18);
    }

    #[test]
    fun test_truncation_bias_on_decrease() {
        // 1 at 10 decimals down to 9 loses one unit
        assert!(pool::convert_amount(1, 10, 9) == 0, 10);
        // Round trip is biased toward zero when decreasing then increasing
        let down = pool::convert_amount(123, 10, 9); // 12
        let up = pool::convert_amount(down, 9, 10);  // 120
        assert!(up < 123, 11);
    }
}

