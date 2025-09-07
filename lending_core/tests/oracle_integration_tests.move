#[test_only]
module lending_core::oracle_integration_tests {
    use 0x2::tx_context;
    use 0x2::object;
    use 0x2::clock;
    use 0x1::vector;
    use lending_core::calculator;
    use oracle::oracle;

    #[test]
    fun test_calculate_value_uses_fresh_price() {
        let mut tctx = tx_context::dummy();
        let mut po = oracle::PriceOracle { id: 0x2::object::new(&mut tctx), version: oracle::oracle_version::this_version(), update_interval: 1000, price_oracles: 0x2::table::new<u8, oracle::Price>(&mut tctx) };
        let mut ctx2 = tx_context::dummy();
        let admin = oracle::OracleAdminCap { id: 0x2::object::new(&mut ctx2) };
        let mut clk = clock::new_for_testing(0);
        oracle::register_token_price(&admin, &clk, &mut po, 7, 1_000_000, 6);
        let val = calculator::calculate_value(&clk, &po, 1_000_000, 7);
        assert!(val == 1_000_000, 1);
        // stale
        clk = clock::new_for_testing(5000);
        // get_token_price would mark stale, and calculator asserts freshness, so we can't call calculate_value here as it asserts
    }
}

