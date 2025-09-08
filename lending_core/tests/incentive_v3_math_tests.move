#[test_only]
module lending_core::incentive_v3_math_tests {
    use 0x2::tx_context;
    use lending_core::incentive_v3;
    use lending_core::ray_math;
    use lending_core::manage;
    use lending_core::incentive_v2;

    #[test]
    fun test_set_max_reward_rate_div_guard() {
        let mut ctx = tx_context::dummy();
        let mut inc = incentive_v3::Incentive{ id: 0x2::object::new(&mut ctx), version: 1, pools: 0x2::table::new<address, incentive_v3::PoolSetting>(&mut ctx), rules: 0x2::table::new<address, incentive_v3::Rule>(&mut ctx), borrow_fee_rate: 0 };
        let mut ctx2 = tx_context::dummy();
        let owner = incentive_v2::OwnerCap{ id: 0x2::object::new(&mut ctx2) };
        // Create a dummy rule id and ensure set_max_reward_rate_by_rule_id uses ray_div internally guarded by arg3>0
        let rule_id = 0x2::object::uid_to_address(&0x2::object::new(&mut ctx));
        // If duration == 0, internal code uses previous check; our call path expects arg4>0
        // Just ensure function is callable; functional verification requires full setup
        manage::set_incentive_v3_max_reward_rate_by_rule_id<u64>(&owner, &mut inc, rule_id, 1, 1);
    }
}

