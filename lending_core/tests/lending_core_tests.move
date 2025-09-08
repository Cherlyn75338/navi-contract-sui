#[test_only]
module lending_core::lending_core_tests {
	use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::constants;
	use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::version;
	use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::ray_math;
	use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::pool;
	use 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::calculator;

	#[test]
	fun test_version_pre_check_success() {
		version::pre_check_version(constants::version());
	}

	#[test, expected_failure(abort_code = 1400)]
	fun test_version_pre_check_failure() {
		version::pre_check_version(constants::version() + 1);
	}

	#[test]
	fun test_constants_values() {
		assert!(constants::FlashLoanMultiple() == 10000, 73000);
		assert!(constants::percentage_benchmark() == 10000, 73001);
	}

	#[test]
	fun test_calculate_linear_interest_basic() {
		let rate = ray_math::ray_div(5u256 * ray_math::ray(), 100u256); // 5% APR
		let sec = 3153600u256; // ~0.1 year
		let lin = calculator::calculate_linear_interest(sec, rate);
		// linear interest = 1 + r * t / YEAR; for 0.1 year and 5% => 1.5%
		let expected = ray_math::ray() + ray_math::ray_div(rate * sec, constants::seconds_per_year());
		assert!(lin == expected, 73002);
	}

	#[test]
	fun test_calculate_compounded_interest_monotone() {
		let rate = ray_math::ray_div(10u256 * ray_math::ray(), 100u256); // 10%
		let c1 = calculator::calculate_compounded_interest(1u256, rate);
		let c2 = calculator::calculate_compounded_interest(2u256, rate);
		assert!(c2 >= c1, 73003);
	}

	#[test]
	fun test_pool_convert_amount_round_trip() {
		let v6: u64 = 123456u64;
		let v9 = pool::convert_amount(v6, 6, 9);
		assert!(pool::convert_amount(v9, 9, 6) == v6, 73004);
	}
}
