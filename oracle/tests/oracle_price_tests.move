#[test_only]
module oracle::oracle_price_tests {
    use oracle::oracle_constants;

    #[test]
    fun test_constants_sane() {
        assert!(oracle_constants::default_update_interval() > 0, 1);
        assert!(oracle_constants::default_decimal_limit() > 0, 2);
    }
}

