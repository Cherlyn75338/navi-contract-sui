#[test_only]
module oracle::oracle_price_tests {
    use 0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f::oracle;
    use 0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f::oracle_error;
    use 0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f::oracle_constants;
    use 0x2::clock;
    use 0x2::test_scenario as ts;

    #[test]
    fun test_register_update_price_and_freshness() {
        let scenario = ts::begin(1);
        // publish oracle package objects
        ts::next_tx(&scenario);
        oracle::init(ts::ctx_mut(&scenario));

        // take shared objects
        let clock_obj = ts::take_shared<clock::Clock>(&scenario);
        let mut po = ts::take_shared<oracle::PriceOracle>(&scenario);
        let admin = ts::take_from_address<oracle::OracleAdminCap>(&scenario, ts::sender(&scenario));
        let feeder = ts::take_from_address<oracle::OracleFeederCap>(&scenario, ts::sender(&scenario));

        // register price id=1 with 8 decimals
        let dec: u8 = 8;
        ts::next_tx(&scenario);
        oracle::register_token_price(&admin, &clock_obj, &mut po, 1, 100000000u256, dec);

        // get fresh price
        let (fresh, value, d) = oracle::get_token_price(&clock_obj, &po, 1);
        assert!(fresh, 100);
        assert!(value == 100000000u256, 101);
        assert!(d == dec, 102);

        // update price to zero makes fresh=false
        ts::next_tx(&scenario);
        oracle::update_token_price(&feeder, &clock_obj, &mut po, 1, 0u256);
        let (fresh2, _, _) = oracle::get_token_price(&clock_obj, &po, 1);
        assert!(!fresh2, 103);

        // widen interval and ensure still >0 constraint
        ts::next_tx(&scenario);
        oracle::set_update_interval(&admin, &mut po, 1);
        // set to zero should abort
        ts::next_tx(&scenario);
        ts::expect_failure(oracle_error::invalid_value());
        oracle::set_update_interval(&admin, &mut po, 0);

        // cleanup
        ts::return_shared(&scenario, clock_obj);
        ts::return_shared(&scenario, po);
        ts::return_to_address(&scenario, admin, ts::sender(&scenario));
        ts::return_to_address(&scenario, feeder, ts::sender(&scenario));
        ts::end(scenario);
    }

    #[test]
    fun test_register_decimal_bounds_and_batch_length() {
        let scenario = ts::begin(2);
        ts::next_tx(&scenario);
        oracle::init(ts::ctx_mut(&scenario));

        let clock_obj = ts::take_shared<clock::Clock>(&scenario);
        let mut po = ts::take_shared<oracle::PriceOracle>(&scenario);
        let admin = ts::take_from_address<oracle::OracleAdminCap>(&scenario, ts::sender(&scenario));
        let feeder = ts::take_from_address<oracle::OracleFeederCap>(&scenario, ts::sender(&scenario));

        // valid bound: decimals in (0..=default_decimal_limit)
        ts::next_tx(&scenario);
        oracle::register_token_price(&admin, &clock_obj, &mut po, 7, 1u256, oracle_constants::default_decimal_limit());

        // invalid: decimals = 0 -> abort
        ts::next_tx(&scenario);
        ts::expect_failure(oracle_error::invalid_value());
        oracle::register_token_price(&admin, &clock_obj, &mut po, 8, 1u256, 0);

        // invalid: decimals > limit -> abort
        ts::next_tx(&scenario);
        ts::expect_failure(oracle_error::invalid_value());
        oracle::register_token_price(&admin, &clock_obj, &mut po, 9, 1u256, oracle_constants::default_decimal_limit() + 1);

        // batch length mismatch
        ts::next_tx(&scenario);
        let ids = vector[1u8, 2u8];
        let prices = vector[1u256];
        ts::expect_failure(oracle_error::price_length_not_match());
        oracle::update_token_price_batch(&feeder, &clock_obj, &mut po, ids, prices);

        ts::return_shared(&scenario, clock_obj);
        ts::return_shared(&scenario, po);
        ts::return_to_address(&scenario, admin, ts::sender(&scenario));
        ts::return_to_address(&scenario, feeder, ts::sender(&scenario));
        ts::end(scenario);
    }
}

