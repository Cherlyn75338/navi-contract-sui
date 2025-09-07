#[test_only]
module lending_core::ray_math_tests {
    use lending_core::ray_math;
    use 0x2::address;

    #[test]
    fun test_ray_constants() {
        assert!(ray_math::ray() == 1000000000000000000000000000, 1);
        assert!(ray_math::half_ray() * 2 == ray_math::ray(), 2);
        assert!(ray_math::wad() == 1000000000000000000, 3);
        assert!(ray_math::half_wad() * 2 == ray_math::wad(), 4);
    }

    #[test]
    fun test_ray_mul_div_round_trip() {
        let a: u256 = 333333333333333333333333333; // 0.333... ray
        let b: u256 = 777777777777777777777777777; // 0.777... ray
        let prod = ray_math::ray_mul(a, b);
        // prod / b ~= a
        let back = ray_math::ray_div(prod, b);
        assert!(back == a, 10);
    }

    #[test, expected_failure(abort_code = 1103)]
    fun test_ray_div_by_zero_abort() { let _ = ray_math::ray_div(1, 0); }

    #[test]
    fun test_wad_to_ray_ray_to_wad_consistency() {
        let cases = vector<u256>[0, 1, 10, 1000, 1000000000, 1234567890123456789];
        let i = 0;
        while (i < 6) {
            let w = *&cases[i];
            let r = ray_math::wad_to_ray(w);
            let w2 = ray_math::ray_to_wad(r);
            assert!(w2 == w, 20);
            i = i + 1;
        };
    }

    #[test, expected_failure(abort_code = 1101)]
    fun test_ray_mul_overflow_guard() {
        let big = address::max();
        let _ = ray_math::ray_mul(big, big);
    }
}

