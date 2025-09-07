#[test_only]
module oracle::oracle_price_tests {
    use 0x2::clock;
    use 0x2::tx_context;
    use oracle::oracle;
    use oracle::oracle_constants;

    #[test]
    fun test_register_and_get_token_price_fresh() {
        let mut ctx = tx_context::dummy();
        let mut tctx = tx_context::dummy();
        let mut po = oracle::PriceOracle { id: 0x2::object::new(&mut tctx), version: oracle::oracle_version::this_version(), update_interval: oracle_constants::default_update_interval(), price_oracles: 0x2::table::new<u8, oracle::Price>(&mut tctx) };
        let mut ctx2 = tx_context::dummy();
        let admin = oracle::OracleAdminCap { id: 0x2::object::new(&mut ctx2) };
        let scenario_clock = clock::new_for_testing(0);
        oracle::register_token_price(&admin, &scenario_clock, &mut po, 1, 1000, 8);
        let (fresh, price, dec) = oracle::get_token_price(&scenario_clock, &po, 1);
        assert!(fresh, 10);
        assert!(price == 1000, 11);
        assert!(dec == 8, 12);
    }

    #[test, expected_failure]
    fun test_register_invalid_decimals_fail() {
        let mut tctx = tx_context::dummy();
        let mut po = oracle::PriceOracle { id: 0x2::object::new(&mut tctx), version: oracle::oracle_version::this_version(), update_interval: oracle_constants::default_update_interval(), price_oracles: 0x2::table::new<u8, oracle::Price>(&mut tctx) };
        let mut clk = clock::new_for_testing(0);
        let mut ctx2 = tx_context::dummy();
        let admin = oracle::OracleAdminCap { id: 0x2::object::new(&mut ctx2) };
        // decimal 0 is invalid
        oracle::register_token_price(&admin, &clk, &mut po, 1, 1, 0);
    }

    #[test]
    fun test_price_freshness_window() {
        let mut tctx = tx_context::dummy();
        let mut po = oracle::PriceOracle { id: 0x2::object::new(&mut tctx), version: oracle::oracle_version::this_version(), update_interval: 1000, price_oracles: 0x2::table::new<u8, oracle::Price>(&mut tctx) };
        let mut ctx2 = tx_context::dummy();
        let admin = oracle::OracleAdminCap { id: 0x2::object::new(&mut ctx2) };
        let mut clk = clock::new_for_testing(0);
        oracle::register_token_price(&admin, &clk, &mut po, 1, 100, 8);
        let (fresh0, _, _) = oracle::get_token_price(&clk, &po, 1);
        assert!(fresh0, 20);
        // Advance time beyond update_interval
        clk = clock::new_for_testing(2000);
        let (fresh1, _, _) = oracle::get_token_price(&clk, &po, 1);
        assert!(!fresh1, 21);
    }
}

