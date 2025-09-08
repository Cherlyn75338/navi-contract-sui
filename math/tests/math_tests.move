#[test_only]
module math::math_tests {
	use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::ray_math;
	use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::safe_math;
	// Keep tests self-contained in math package; cross-package tests live elsewhere

	const E_DELTA_TOO_LARGE: u64 = 70001;

	#[test]
	fun test_wad_to_ray_round_trip_identity() {
		let w = 1234567890000000000u256; // multiple of 1e9 to ensure perfect round trip
		let r = ray_math::wad_to_ray(w);
		let w_back = ray_math::ray_to_wad(r);
		assert!(w_back == w, 70000);
	}

	#[test]
	fun test_ray_to_wad_round_trip_bounded_loss() {
		let r = 1234567890123456789012345678u256; // arbitrary ray value
		let w = ray_math::ray_to_wad(r);
		let r_back = ray_math::wad_to_ray(w);
		let delta = if (r_back > r) { r_back - r } else { r - r_back };
		// ray_to_wad uses half-up with 1e9 granularity; error <= 5e8 in ray units
		assert!(delta <= 500000000u256, E_DELTA_TOO_LARGE);
	}

	#[test]
	fun test_ray_mul_div_guards_and_behaviour() {
		let a = ray_math::ray();
		let b = 3u256 * ray_math::ray();
		let m = ray_math::ray_mul(a, b); // ~3 ray
		let three_in_ray = ray_math::ray_div(m, ray_math::ray());
		assert!(three_in_ray == 3u256 * ray_math::ray(), 70002);
	}

	#[test, expected_failure(abort_code = 1103)]
	fun test_ray_div_by_zero_panics() {
		let _ = ray_math::ray_div(1u256, 0u256);
	}

	#[test]
	fun test_safe_math_min_add_sub() {
		let x = 123456u256;
		let y = 7890u256;
		assert!(safe_math::min(x, y) == y, 70003);
		let s = safe_math::add(x, y);
		let d = safe_math::sub(s, y);
		assert!(d == x, 70004);
	}

	// Removed pool/constants/oracle_utils cross-package tests
}
