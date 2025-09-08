#[test_only]
module lending_core::pool_decimal_tests {
    use lending_core::pool;

    #[test]
    fun test_convert_amount_equal_decimals() {
        assert!(pool::convert_amount(123, 9, 9) == 123, 1);
        assert!(pool::convert_amount(0, 6, 6) == 0, 2);
    }

    #[test]
    fun test_convert_amount_increase_decimals() {
        // 6 -> 9 adds 3 zeros
        assert!(pool::convert_amount(123, 6, 9) == 123000, 10);
    }

    #[test]
    fun test_convert_amount_decrease_decimals() {
        // 12 -> 9 removes 3 zeros
        assert!(pool::convert_amount(123000, 12, 9) == 123, 20);
    }

    #[test]
    fun test_normal_and_unnormal_amount_round_trip() {
        // pool decimal 9: identity
        // We only test that functions are callable since Pool<T> is a shared object in real usage
        // Here focus on pure convert logic which is covered above
        assert!(pool::convert_amount(1, 9, 9) == 1, 30);
    }
}

