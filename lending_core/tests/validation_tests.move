#[test_only]
module lending_core::validation_tests {
    use 0x2::tx_context;
    use 0x2::object;
    use 0x1::type_name;
    use 0x1::vector;
    use lending_core::storage;
    use lending_core::validation;
    use lending_core::ray_math;

    struct DummyCap has store, key { id: object::UID }

    #[test]
    fun test_validate_borrow_caps_and_types() {
        // Minimal isolated test: construct a Storage with one reserve and set fields needed for validation
        let mut tctx = tx_context::dummy();
        // Build Storage with one reserve slot 0
        let mut st = storage::Storage{
            id: object::new(&mut tctx),
            version: 1,
            paused: false,
            reserves: 0x2::table::new<u8, storage::ReserveData>(&mut tctx),
            reserves_count: 0,
            users: vector::empty<address>(),
            user_info: 0x2::table::new<address, storage::UserInfo>(&mut tctx),
        };
        let tb = storage::TokenBalance{ user_state: 0x2::table::new<address, u256>(&mut tctx), total_supply: 0 };
        let bb = storage::TokenBalance{ user_state: 0x2::table::new<address, u256>(&mut tctx), total_supply: 0 };
        let brf = storage::BorrowRateFactors{ base_rate: 0, multiplier: 0, jump_rate_multiplier: 0, reserve_factor: 0, optimal_utilization: ray_math::ray() };
        let lf = storage::LiquidationFactors{ ratio: 0, bonus: 0, threshold: ray_math::ray() };
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
        // supply 100 units (ray-scaled via index==ray)
        let (_, _borrow) = storage::get_total_supply(&mut st, 0);
        storage::increase_total_supply_balance(&mut st, 0, 100);
        // Valid: borrow 50 < supply 100 and ratio <= 1.0
        validation::validate_borrow<u64>(&mut st, 0, 50);
    }

    #[test, expected_failure]
    fun test_validate_deposit_cap_enforced() {
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
        let tb = storage::TokenBalance{ user_state: 0x2::table::new<address, u256>(&mut tctx), total_supply: 0 };
        let bb = storage::TokenBalance{ user_state: 0x2::table::new<address, u256>(&mut tctx), total_supply: 0 };
        let brf = storage::BorrowRateFactors{ base_rate: 0, multiplier: 0, jump_rate_multiplier: 0, reserve_factor: 0, optimal_utilization: ray_math::ray() };
        let lf = storage::LiquidationFactors{ ratio: 0, bonus: 0, threshold: ray_math::ray() };
        let rd = storage::ReserveData{
            id: 0,
            oracle_id: 0,
            coin_type: type_name::into_string(type_name::get<u64>()),
            is_isolated: false,
            supply_cap_ceiling: 100 * ray_math::ray(),
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
        // Attempt to deposit pushing above ceiling according to current comparison logic
        validation::validate_deposit<u64>(&mut st, 0, 101);
    }
}

