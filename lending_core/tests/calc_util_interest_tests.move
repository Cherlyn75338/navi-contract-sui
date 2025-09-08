#[test_only]
module lending_core::calc_util_interest_tests {
    use 0x2::tx_context;
    use 0x2::object;
    use 0x1::type_name;
    use lending_core::storage;
    use lending_core::calculator;
    use lending_core::dynamic_calculator;
    use lending_core::ray_math;
    use 0x2::clock;
    use 0x1::vector;

    fun mk_storage_with_balances(supply_norm: u256, borrow_norm: u256): storage::Storage {
        let mut tctx = tx_context::dummy();
        let tb = storage::TokenBalance{ user_state: 0x2::table::new<address, u256>(&mut tctx), total_supply: supply_norm };
        let bb = storage::TokenBalance{ user_state: 0x2::table::new<address, u256>(&mut tctx), total_supply: borrow_norm };
        let brf = storage::BorrowRateFactors{ base_rate: 0, multiplier: ray_math::ray(), jump_rate_multiplier: ray_math::ray(), reserve_factor: 0, optimal_utilization: ray_math::ray()/2 };
        let lf = storage::LiquidationFactors{ ratio: 0, bonus: 0, threshold: ray_math::ray() };
        let mut st = storage::Storage{
            id: object::new(&mut tctx),
            version: 1,
            paused: false,
            reserves: 0x2::table::new<u8, storage::ReserveData>(&mut tctx),
            reserves_count: 0,
            users: vector::empty<address>(),
            user_info: 0x2::table::new<address, storage::UserInfo>(&mut tctx),
        };
        let rd = storage::ReserveData{
            id: 0,
            oracle_id: 0,
            coin_type: type_name::into_string(type_name::get<u64>()),
            is_isolated: false,
            supply_cap_ceiling: 10 * ray_math::ray(),
            borrow_cap_ceiling: ray_math::ray(),
            current_supply_rate: 0,
            current_borrow_rate: 0,
            current_supply_index: ray_math::ray(),
            current_borrow_index: ray_math::ray(),
            supply_balance: tb,
            borrow_balance: bb,
            last_update_timestamp: 0,
            ltv: ray_math::ray(),
            treasury_factor: 0,
            treasury_balance: 0,
            borrow_rate_factors: brf,
            liquidation_factors: lf,
            reserve_field_a: 0,
            reserve_field_b: 0,
            reserve_field_c: 0,
        };
        0x2::table::add<u8, storage::ReserveData>(&mut st.reserves, 0, rd);
        st.reserves_count = 1;
        st
    }

    #[test]
    fun test_caculate_utilization_zero_when_borrow_zero() {
        let mut st = mk_storage_with_balances(100, 0);
        let u = calculator::caculate_utilization(&mut st, 0);
        assert!(u == 0, 1);
    }

    #[test]
    fun test_caculate_utilization_positive_when_supply_and_borrow() {
        let mut st = mk_storage_with_balances(100, 50);
        let u = calculator::caculate_utilization(&mut st, 0);
        assert!(u > 0 && u <= ray_math::ray(), 2);
    }

    #[test]
    fun test_dynamic_caculate_utilization_zero_when_borrow_zero() {
        let mut st = mk_storage_with_balances(100, 0);
        let clk = clock::create_for_testing(&mut tctx);
        let u = dynamic_calculator::dynamic_caculate_utilization(&clk, &mut st, 0, 0, 0, false);
        assert!(u == 0, 3);
    }

    #[test]
    fun test_interest_functions_nonzero() {
        let dt: u256 = 31536000; // one year
        let rate: u256 = ray_math::ray() / 10; // 10%
        let li = calculator::calculate_linear_interest(dt, rate);
        let ci = calculator::calculate_compounded_interest(dt, rate);
        assert!(li >= ray_math::ray(), 10);
        assert!(ci >= li, 11);
    }
}

