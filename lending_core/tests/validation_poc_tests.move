#[test_only]
module lending_core::validation_poc_tests {
    use lending_core::ray_math;

    const E_BUGGY_SHOULD_PASS: u64 = 10001;
    const E_CORRECT_SHOULD_FAIL: u64 = 10002;

    // Helper: ceil(ray_div(a,b)) in integer math
    fun ceil_ray_div(a: u256, b: u256): u256 {
        let q = ray_math::ray_div(a, b);
        // If exact division (a * RAY) % b == 0, return q; else add 1
        // Implement via: floor + epsilon check by recomputing
        let back = ray_math::ray_mul(q, b);
        if (back < a) { q + 1 } else { q }
    }

    // POC 1: Borrow validation mismatch
    // v4 = ray_mul(v0, v2) (supply value), v5 = ray_mul(v1, v3) (borrow value)
    // Buggy checks use (v5 + arg2), correct should use (v5 + ray_mul(arg2, v3))
    #[test]
    fun poc_borrow_liquidity_and_cap() {
        // Choose realistic nontrivial indices
        let v2 /* supply_index */: u256 = ray_math::ray(); // 1.0
        let v3 /* borrow_index */: u256 = ray_math::ray() + 1000000000000000000; // 1.000000001 ray

        // Totals (normalized)
        let v0 /* supply_total */: u256 = 1_000_000_000; // 1e9
        let v1 /* borrow_total */: u256 = 900_000_000;   // 0.9e9

        let v4 = ray_math::ray_mul(v0, v2); // supply value
        let v5 = ray_math::ray_mul(v1, v3); // borrow value (slightly > normalized due to index)

        // required_value_room = v4 - v5
        let room = v4 - v5;
        // arg2_min = ceil(ray_div(room, v3))
        let arg2_min = ceil_ray_div(room, v3);
        // arg2_max = room - 1 (still passes buggy since not scaled)
        let arg2_max = if (room > 0) { room - 1 } else { 0 };
        assert!(arg2_min <= arg2_max, E_BUGGY_SHOULD_PASS);

        let arg2 = arg2_min;

        // Buggy liquidity check would be: v5 + arg2 < v4
        assert!(v5 + arg2 < v4, E_BUGGY_SHOULD_PASS);

        // Correct liquidity check: v5 + ray_mul(arg2, v3) < v4 should FAIL by construction
        let correct_add = ray_math::ray_mul(arg2, v3);
        assert!(!(v5 + correct_add < v4), E_CORRECT_SHOULD_FAIL);

        // Cap ratio example: choose an arbitrary cap between buggy and correct
        let buggy_ratio = ray_math::ray_div(v5 + arg2, v4);
        let correct_ratio = ray_math::ray_div(v5 + correct_add, v4);
        assert!(buggy_ratio < correct_ratio, 0);
    }

    // POC 2: Withdraw solvency mismatch
    // Buggy uses v4 >= v5 + arg2; correct uses v4 >= v5 + ray_mul(arg2, v2)
    #[test]
    fun poc_withdraw_solvency() {
        let v2: u256 = ray_math::ray() + 10; // supply index slightly > 1
        let v3: u256 = ray_math::ray();
        let v0: u256 = 1_000_000_000; // supply
        let v1: u256 = 900_000_000;   // borrow
        let v4 = ray_math::ray_mul(v0, v2);
        let v5 = ray_math::ray_mul(v1, v3);
        let room = v4 - v5;
        let arg2_min = ceil_ray_div(room, v2);
        let arg2_max = if (room > 0) { room - 1 } else { 0 };
        assert!(arg2_min <= arg2_max, E_BUGGY_SHOULD_PASS);
        let arg2 = arg2_min;
        // Buggy passes
        assert!(v4 >= v5 + arg2, E_BUGGY_SHOULD_PASS);
        // Correct fails
        let correct_add = ray_math::ray_mul(arg2, v2);
        assert!(!(v4 >= v5 + correct_add), E_CORRECT_SHOULD_FAIL);
    }

    // POC 3: Deposit cap mismatch (extra ray and mixed units)
    // Buggy: cap >= (v4 + arg2) * ray()
    // Correct (value units): cap >= v4 + ray_mul(arg2, v2)
    #[test]
    fun poc_deposit_cap() {
        let v2: u256 = ray_math::ray() + 1000; // > 1
        let v0: u256 = 1_000_000_000; // total supply
        let v4 = ray_math::ray_mul(v0, v2);
        let cap: u256 = v4 + 1_000_000; // small headroom in value units

        // Find arg2 such that: (v4 + arg2) * ray() <= cap  (passes buggy)
        // and v4 + ray_mul(arg2, v2) > cap (fails correct)
        let ray = ray_math::ray();
        // arg2_max_bug = floor((cap / ray) − v4)
        let arg2_max_bug = (cap / ray) - v4;
        // arg2_min_true_violate: smallest arg2 with ray_mul(arg2, v2) > (cap − v4)
        let target = cap - v4;
        let mut lo: u256 = 0;
        let mut hi: u256 = target + 1; // upper bound
        while (lo + 1 < hi) {
            let mid = (lo + hi) / 2;
            if (ray_math::ray_mul(mid, v2) > target) { hi = mid } else { lo = mid };
        };
        let arg2_min_true_violate = hi;
        assert!(arg2_min_true_violate <= arg2_max_bug, E_BUGGY_SHOULD_PASS);

        let arg2 = arg2_min_true_violate;
        // Buggy passes
        assert!((v4 + arg2) * ray <= cap, E_BUGGY_SHOULD_PASS);
        // Correct fails
        assert!(v4 + ray_math::ray_mul(arg2, v2) > cap, E_CORRECT_SHOULD_FAIL);
    }
}

