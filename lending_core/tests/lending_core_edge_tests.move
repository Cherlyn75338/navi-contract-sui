#[test_only]
module lending_core::lending_core_edge_tests {
    use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::storage;
    use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::pool;
    use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::logic;
    use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::calculator;
    use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::dynamic_calculator;
    use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::ray_math;
    use 0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f::oracle;
    use 0x2::test_scenario as ts;
    use 0x2::clock;
    use 0x2::coin;

    struct TestCoin has copy, drop {}

    #[test]
    fun test_dynamic_utilization_denominator_zero_guard() {
        let s = ts::begin(100);
        // publish and init packages that create shared objects and caps
        ts::next_tx(&s);
        storage::init(ts::ctx_mut(&s));
        ts::next_tx(&s);
        pool::init(ts::ctx_mut(&s));
        ts::next_tx(&s);
        oracle::init(ts::ctx_mut(&s));

        let clk = ts::take_shared<clock::Clock>(&s);
        let mut stor = ts::take_shared<storage::Storage>(&s);
        let mut poo = ts::take_shared<pool::Pool<TestCoin>>(&s); // created during init_reserve
        let mut pr = ts::take_shared<oracle::PriceOracle>(&s);
        let stor_admin = ts::take_from_address<storage::StorageAdminCap>(&s, ts::sender(&s));
        let pool_admin = ts::take_from_address<pool::PoolAdminCap>(&s, ts::sender(&s));
        let oracle_admin = ts::take_from_address<oracle::OracleAdminCap>(&s, ts::sender(&s));

        // create coin metadata for TestCoin with 9 decimals to match pool normalization
        ts::next_tx(&s);
        let meta = coin::create_currency<TestCoin>(ts::ctx_mut(&s));
        coin::set_decimals<TestCoin>(&meta, 9);

        // init reserve with zero cap ceilings large enough; borrow cap as ray, supply cap as u256
        ts::next_tx(&s);
        storage::init_reserve<TestCoin>(
            &stor_admin,
            &pool_admin,
            &clk,
            &mut stor,
            1, /* oracle id */
            false,
            0x2::address::max(), /* supply cap */
            ray_math::ray(),     /* borrow cap ratio */
            0, 0, 0,             /* rates base/mult/jump */
            ray_math::half_ray(),/* reserve_factor */
            ray_math::half_ray(),/* ltv */
            ray_math::half_ray(),/* liq ratio */
            ray_math::half_ray(),/* liq bonus */
            ray_math::half_ray(),/* liq threshold */
            0, 0,                 /* reserve fields */
            &meta,
            ts::ctx_mut(&s)
        );

        // register price for oracle id=1 with decimals=9
        ts::next_tx(&s);
        oracle::register_token_price(&oracle_admin, &clk, &mut pr, 1, 1u256, 9);

        // Fetch reserve id (last created is id=0)
        let asset_id = 0u8;

        // With zero supplies and zero borrows, caculate_utilization returns 0
        let util = calculator::caculate_utilization(&mut stor, asset_id);
        assert!(util == 0, 1000);

        // dynamic_caculate_utilization with positive borrow delta and zero supply delta would divide by zero if not guarded
        let dyn_util = dynamic_calculator::dynamic_caculate_utilization(&clk, &mut stor, asset_id, 0, 1, true);
        // Expected: 0 when denom is zero per implementation
        assert!(dyn_util == 0, 1001);

        // cleanup shared objects and caps
        ts::return_shared(&s, clk);
        ts::return_shared(&s, stor);
        ts::return_shared(&s, poo);
        ts::return_shared(&s, pr);
        ts::return_to_address(&s, stor_admin, ts::sender(&s));
        ts::return_to_address(&s, pool_admin, ts::sender(&s));
        ts::return_to_address(&s, oracle_admin, ts::sender(&s));
        ts::end(s);
    }

    #[test]
    fun test_cumulate_to_supply_index_zero_total_supply_noop() {
        let s = ts::begin(101);
        ts::next_tx(&s);
        storage::init(ts::ctx_mut(&s));
        ts::next_tx(&s);
        pool::init(ts::ctx_mut(&s));
        ts::next_tx(&s);
        oracle::init(ts::ctx_mut(&s));

        let clk = ts::take_shared<clock::Clock>(&s);
        let mut stor = ts::take_shared<storage::Storage>(&s);
        let mut poo = ts::take_shared<pool::Pool<TestCoin>>(&s);
        let stor_admin = ts::take_from_address<storage::StorageAdminCap>(&s, ts::sender(&s));
        let pool_admin = ts::take_from_address<pool::PoolAdminCap>(&s, ts::sender(&s));

        ts::next_tx(&s);
        let meta = coin::create_currency<TestCoin>(ts::ctx_mut(&s));
        coin::set_decimals<TestCoin>(&meta, 9);

        // create reserve (no deposits -> total supply == 0)
        ts::next_tx(&s);
        storage::init_reserve<TestCoin>(&stor_admin, &pool_admin, &clk, &mut stor, 0, false, 0x2::address::max(), ray_math::ray(), 0,0,0, ray_math::half_ray(), ray_math::half_ray(), ray_math::half_ray(), ray_math::half_ray(), ray_math::half_ray(), 0, 0, &meta, ts::ctx_mut(&s));

        let asset_id = 0u8;
        // Attempt to cumulate with non-zero accrual when total supply is 0; should not abort
        ts::next_tx(&s);
        logic::cumulate_to_supply_index(&mut stor, asset_id, 1);

        ts::return_shared(&s, clk);
        ts::return_shared(&s, stor);
        ts::return_shared(&s, poo);
        ts::end(s);
    }

    #[test]
    fun test_pool_convert_amount_rounding_and_bounds() {
        // simple deterministic checks on convert_amount for large decimal diffs
        assert!(pool::convert_amount(1, 9, 9) == 1, 2000);
        assert!(pool::convert_amount(1, 6, 9) == 1000, 2001);
        assert!(pool::convert_amount(1000, 9, 6) == 1, 2002);
        // Up and down conversions should compose to <= original due to integer division
        let up = pool::convert_amount(123456789, 6, 9);
        let down = pool::convert_amount(up, 9, 6);
        assert!(down <= 123456789, 2003);
    }
}

