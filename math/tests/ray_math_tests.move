#[test_only]
module math::ray_math_tests {
    use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::ray_math;

    #[test]
    fun test_ray_constants() {
        assert!(ray_math::ray() == 1000000000000000000000000000, 0);
        assert!(ray_math::wad() == 1000000000000000000, 1);
        assert!(ray_math::half_ray() * 2 == ray_math::ray(), 2);
        assert!(ray_math::half_wad() * 2 == ray_math::wad(), 3);
    }

    #[test]
    fun test_ray_div_basic_and_rounding() {
        // 0 / anything = 0
        assert!(ray_math::ray_div(0, ray_math::ray()) == 0, 10);
        // Half-up rounding: ray_div(ray(), 2*ray()) == half_ray
        let two_ray = ray_math::ray() + ray_math::ray();
        assert!(ray_math::ray_div(ray_math::ray(), two_ray) == ray_math::half_ray(), 11);
        // Generic: 1 / 2 in ray space using integers
        assert!(ray_math::ray_div(1, 2) == ray_math::half_ray(), 12);
    }

    #[test, expected_failure(abort_code = 1103)]
    fun test_ray_div_by_zero_aborts() {
        let _ = ray_math::ray_div(1, 0);
    }

    #[test]
    fun test_ray_mul_basic_and_rounding() {
        // Zero short-circuit
        assert!(ray_math::ray_mul(0, ray_math::ray()) == 0, 20);
        assert!(ray_math::ray_mul(ray_math::ray(), 0) == 0, 21);
        // ray * 1 == ray
        assert!(ray_math::ray_mul(ray_math::ray(), ray_math::ray()) == ray_math::ray(), 22);
        // ray * half_ray == half_ray
        assert!(ray_math::ray_mul(ray_math::ray(), ray_math::half_ray()) == ray_math::half_ray(), 23);
        // rounding half-up behavior around boundary
        let near_half_up = ray_math::half_ray() - 1;
        assert!(ray_math::ray_mul(ray_math::ray(), near_half_up) == near_half_up, 24);
        let near_half_up2 = ray_math::half_ray() + 1;
        assert!(ray_math::ray_mul(ray_math::ray(), near_half_up2) == near_half_up2, 25);
    }

    #[test]
    fun test_wad_ray_conversions() {
        // wad_to_ray(ray_to_wad(x)) <= x with half-up rounding; check boundaries
        let x = ray_math::ray();
        let x_wad = ray_math::ray_to_wad(x);
        let x_roundtrip = ray_math::wad_to_ray(x_wad);
        assert!(x_roundtrip == x, 30);

        // One less than ray rounds down in wad, then back up not exceeding original
        let y = ray_math::ray() - 1;
        let y_wad = ray_math::ray_to_wad(y);
        let y_roundtrip = ray_math::wad_to_ray(y_wad);
        assert!(y_roundtrip <= y, 31);

        // Half-up effect around 1e9 boundary inside ray_to_wad
        let z = 1000000000; // 1e9
        let z_u256: u256 = z as u256;
        // ray_to_wad adds 1e9/2 before division; ensure monotonic
        assert!(ray_math::ray_to_wad(z_u256 - 1) <= ray_math::ray_to_wad(z_u256), 32);
    }
}

