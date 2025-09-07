#[test_only]
module math::ray_math_tests {
    use math::ray_math;
    use 0x2::address;

    #[test]
    fun test_ray_mul_identity() {
        let one = ray_math::ray();
        assert!(ray_math::ray_mul(one, one) == one, 100);
        let x: u256 = 123456789000000000000000000; // 1.23456789e26
        assert!(ray_math::ray_mul(x, one) == x, 101);
        assert!(ray_math::ray_mul(one, x) == x, 102);
    }

    #[test]
    fun test_wad_mul_identity() {
        let one = ray_math::wad();
        assert!(ray_math::wad_mul(one, one) == one, 200);
        let x: u256 = 987654321000000000; // 0.987654321e18
        assert!(ray_math::wad_mul(x, one) == x, 201);
        assert!(ray_math::wad_mul(one, x) == x, 202);
    }

    #[test]
    fun test_ray_div_identity() {
        let one = ray_math::ray();
        let x: u256 = 888888888888888888888888888; // ~0.8888 ray
        assert!(ray_math::ray_div(x, one) == x, 300);
    }

    #[test, expected_failure(abort_code = 1103)]
    fun test_ray_div_by_zero_fails() {
        let _ = ray_math::ray_div(1, 0);
    }

    #[test, expected_failure(abort_code = 1101)]
    fun test_ray_mul_overflow_fails() {
        // Force overflow via guard in ray_mul
        let big: u256 = address::max();
        let _ = ray_math::ray_mul(big, big);
    }

    #[test]
    fun test_wad_to_ray_and_back_exact_on_billions() {
        // If value is an exact multiple of 1e9, round-trip should be exact
        let wad_val: u256 = 1234567890123456789; // any wad
        let ray_val = ray_math::wad_to_ray(wad_val);
        let back = ray_math::ray_to_wad(ray_val);
        assert!(back == wad_val, 400);
    }
}

