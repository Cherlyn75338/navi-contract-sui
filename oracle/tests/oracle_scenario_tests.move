#[test_only]
module oracle::oracle_scenario_tests {
    use 0x2::test_scenario;
    use 0x2::clock;

    use oracle::oracle;
    use oracle::oracle_constants;

    // Happy path: create and share PriceOracle and Clock, register price via admin, read fresh price
    #[test]
    fun test_shared_register_and_read_fresh() {
        let sender: address = @0xA;
        let mut scenario = test_scenario::begin(sender);

        // Tx 1: set up shared objects and caps
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let po = oracle::new_price_oracle_for_testing(ctx, 3_000);
            oracle::share_price_oracle_for_testing(po);

            let clk = clock::create_for_testing(ctx);
            clock::share_for_testing(clk);

            let admin = oracle::admin_cap_for_testing(ctx);
            0x2::transfer::public_transfer<oracle::OracleAdminCap>(admin, sender);

            let feeder = oracle::feeder_cap_for_testing(ctx);
            0x2::transfer::public_transfer<oracle::OracleFeederCap>(feeder, sender);
        };
        test_scenario::next_tx(&mut scenario, sender);

        // Tx 2: register and read
        {
            let mut po = test_scenario::take_shared<oracle::PriceOracle>(&scenario);
            let clk = test_scenario::take_shared<clock::Clock>(&scenario);
            let admin = test_scenario::take_from_sender<oracle::OracleAdminCap>(&scenario);

            oracle::register_token_price(&admin, &clk, &mut po, 7, 1_000_000, 6);
            let (fresh, val, dec) = oracle::get_token_price(&clk, &po, 7);
            assert!(fresh, 10);
            assert!(val == 1_000_000, 11);
            assert!(dec == 6, 12);

            // Return shared and owned
            test_scenario::return_shared(clk);
            test_scenario::return_shared(po);
            test_scenario::return_to_sender(&scenario, admin);
        };

        test_scenario::end(scenario);
    }

    // Freshness window: price becomes stale after interval, feeder update refreshes it
    #[test]
    fun test_shared_price_staleness_and_refresh() {
        let sender: address = @0xB;
        let mut scenario = test_scenario::begin(sender);

        // Tx 1 setup
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let po = oracle::new_price_oracle_for_testing(ctx, 1_000);
            oracle::share_price_oracle_for_testing(po);
            let clk = clock::create_for_testing(ctx);
            clock::share_for_testing(clk);
            let admin = oracle::admin_cap_for_testing(ctx);
            0x2::transfer::public_transfer<oracle::OracleAdminCap>(admin, sender);
            let feeder = oracle::feeder_cap_for_testing(ctx);
            0x2::transfer::public_transfer<oracle::OracleFeederCap>(feeder, sender);
        };
        test_scenario::next_tx(&mut scenario, sender);

        // Tx 2: register
        {
            let mut po = test_scenario::take_shared<oracle::PriceOracle>(&scenario);
            let mut clk = test_scenario::take_shared<clock::Clock>(&scenario);
            let admin = test_scenario::take_from_sender<oracle::OracleAdminCap>(&scenario);
            oracle::register_token_price(&admin, &clk, &mut po, 9, 42, 8);
            test_scenario::return_shared(clk);
            test_scenario::return_shared(po);
            test_scenario::return_to_sender(&scenario, admin);
        };
        test_scenario::next_tx(&mut scenario, sender);

        // Tx 3: become stale then refresh via feeder
        {
            let mut po = test_scenario::take_shared<oracle::PriceOracle>(&scenario);
            let mut clk = test_scenario::take_shared<clock::Clock>(&scenario);
            // Advance time past update interval
            clock::increment_for_testing(&mut clk, 1_500);
            let (fresh1, _, _) = oracle::get_token_price(&clk, &po, 9);
            assert!(!fresh1, 20);

            let feeder = test_scenario::take_from_sender<oracle::OracleFeederCap>(&scenario);
            oracle::update_token_price(&feeder, &clk, &mut po, 9, 43);
            let (fresh2, val2, _) = oracle::get_token_price(&clk, &po, 9);
            assert!(fresh2, 21);
            assert!(val2 == 43, 22);

            test_scenario::return_shared(clk);
            test_scenario::return_shared(po);
            test_scenario::return_to_sender(&scenario, feeder);
        };

        test_scenario::end(scenario);
    }

    // Batch update length mismatch should abort
    #[test, expected_failure]
    fun test_shared_batch_update_length_mismatch_aborts() {
        let sender: address = @0xC;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let po = oracle::new_price_oracle_for_testing(ctx, oracle_constants::default_update_interval());
            oracle::share_price_oracle_for_testing(po);
            let clk = clock::create_for_testing(ctx);
            clock::share_for_testing(clk);
            let admin = oracle::admin_cap_for_testing(ctx);
            0x2::transfer::public_transfer<oracle::OracleAdminCap>(admin, sender);
            let feeder = oracle::feeder_cap_for_testing(ctx);
            0x2::transfer::public_transfer<oracle::OracleFeederCap>(feeder, sender);
        };
        test_scenario::next_tx(&mut scenario, sender);
        {
            let mut po = test_scenario::take_shared<oracle::PriceOracle>(&scenario);
            let clk = test_scenario::take_shared<clock::Clock>(&scenario);
            let admin = test_scenario::take_from_sender<oracle::OracleAdminCap>(&scenario);
            // Register one id
            oracle::register_token_price(&admin, &clk, &mut po, 1, 10, 8);
            let feeder = test_scenario::take_from_sender<oracle::OracleFeederCap>(&scenario);
            // Mismatched lengths: ids=[1,2], prices=[100]
            let ids = vector[1u8, 2u8];
            let prices = vector[100u256];
            oracle::update_token_price_batch(&feeder, &clk, &mut po, ids, prices);
            // Cleanup (won't reach here due to abort)
            test_scenario::return_shared(clk);
            test_scenario::return_shared(po);
            test_scenario::return_to_sender(&scenario, admin);
            test_scenario::return_to_sender(&scenario, feeder);
        };
        test_scenario::end(scenario);
    }

    // Duplicate register of same id should abort
    #[test, expected_failure]
    fun test_shared_duplicate_register_aborts() {
        let sender: address = @0xD;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let po = oracle::new_price_oracle_for_testing(ctx, 5_000);
            oracle::share_price_oracle_for_testing(po);
            let clk = clock::create_for_testing(ctx);
            clock::share_for_testing(clk);
            let admin = oracle::admin_cap_for_testing(ctx);
            0x2::transfer::public_transfer<oracle::OracleAdminCap>(admin, sender);
        };
        test_scenario::next_tx(&mut scenario, sender);
        {
            let mut po = test_scenario::take_shared<oracle::PriceOracle>(&scenario);
            let clk = test_scenario::take_shared<clock::Clock>(&scenario);
            let admin = test_scenario::take_from_sender<oracle::OracleAdminCap>(&scenario);
            oracle::register_token_price(&admin, &clk, &mut po, 3, 123, 8);
            // Duplicate
            oracle::register_token_price(&admin, &clk, &mut po, 3, 456, 8);
            // Cleanup (won't reach here)
            test_scenario::return_shared(clk);
            test_scenario::return_shared(po);
            test_scenario::return_to_sender(&scenario, admin);
        };
        test_scenario::end(scenario);
    }

    // Invalid decimals (0 and > limit) should abort on register
    #[test, expected_failure]
    fun test_shared_register_invalid_decimals_zero() {
        let sender: address = @0xE;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let po = oracle::new_price_oracle_for_testing(ctx, 5_000);
            oracle::share_price_oracle_for_testing(po);
            let clk = clock::create_for_testing(ctx);
            clock::share_for_testing(clk);
            let admin = oracle::admin_cap_for_testing(ctx);
            0x2::transfer::public_transfer<oracle::OracleAdminCap>(admin, sender);
        };
        test_scenario::next_tx(&mut scenario, sender);
        {
            let mut po = test_scenario::take_shared<oracle::PriceOracle>(&scenario);
            let clk = test_scenario::take_shared<clock::Clock>(&scenario);
            let admin = test_scenario::take_from_sender<oracle::OracleAdminCap>(&scenario);
            oracle::register_token_price(&admin, &clk, &mut po, 5, 1, 0);
            // Cleanup (won't reach here)
            test_scenario::return_shared(clk);
            test_scenario::return_shared(po);
            test_scenario::return_to_sender(&scenario, admin);
        };
        test_scenario::end(scenario);
    }

    #[test, expected_failure]
    fun test_shared_register_invalid_decimals_too_large() {
        let sender: address = @0xF;
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let po = oracle::new_price_oracle_for_testing(ctx, 5_000);
            oracle::share_price_oracle_for_testing(po);
            let clk = clock::create_for_testing(ctx);
            clock::share_for_testing(clk);
            let admin = oracle::admin_cap_for_testing(ctx);
            transfer::public_transfer<oracle::OracleAdminCap>(admin, sender);
        };
        test_scenario::next_tx(&mut scenario, sender);
        {
            let mut po = test_scenario::take_shared<oracle::PriceOracle>(&scenario);
            let clk = test_scenario::take_shared<clock::Clock>(&scenario);
            let admin = test_scenario::take_from_sender<oracle::OracleAdminCap>(&scenario);
            let too_large = oracle_constants::default_decimal_limit() + 1;
            oracle::register_token_price(&admin, &clk, &mut po, 6, 1, too_large);
            // Cleanup (won't reach here)
            test_scenario::return_shared(clk);
            test_scenario::return_shared(po);
            test_scenario::return_to_sender(&scenario, admin);
        };
        test_scenario::end(scenario);
    }
}

