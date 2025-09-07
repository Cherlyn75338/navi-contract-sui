#[test_only]
module lending_core::fuzz_dos_tests {
    use 0x2::tx_context;
    use 0x2::object;
    use lending_core::storage;
    use lending_core::logic;
    use lending_core::ray_math;
    use 0x1::type_name;
    use 0x1::vector;
    use 0x2::clock;

    #[test]
    fun test_update_state_of_all_iterates_up_to_count() {
        let mut tctx = tx_context::dummy();
        let mut st = storage::Storage{
            id: object::new(&mut tctx),
            version: 1,
            paused: false,
            reserves: 0x2::table::new<u8, storage::ReserveData>(&mut tctx),
            reserves_count: 0,
            users: vector::empty<address>(),
            user_info: 0x2::table::new<address, storage::UserInfo>(&mut tctx),
        };
        let mut i = 0;
        while (i < 5) { // small bounded test
            let tb = storage::TokenBalance{ user_state: 0x2::table::new<address, u256>(&mut tctx), total_supply: 0 };
            let bb = storage::TokenBalance{ user_state: 0x2::table::new<address, u256>(&mut tctx), total_supply: 0 };
            let brf = storage::BorrowRateFactors{ base_rate: 0, multiplier: 0, jump_rate_multiplier: 0, reserve_factor: 0, optimal_utilization: ray_math::ray() };
            let lf = storage::LiquidationFactors{ ratio: 0, bonus: 0, threshold: ray_math::ray() };
            let rd = storage::ReserveData{
                id: i as u8,
                oracle_id: 0,
                coin_type: type_name::into_string(type_name::get<u64>()),
                is_isolated: false,
                supply_cap_ceiling: 0,
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
            0x2::table::add<u8, storage::ReserveData>(&mut st.reserves, i as u8, rd);
            i = i + 1;
        };
        st.reserves_count = 5;
        let clk = clock::new_for_testing(0);
        // Should run without abort (bounded by reserves_count)
        logic::update_state_of_all(&clk, &mut st);
    }
}

