#[test_only]
module oracle::oracle_tests {
	use 0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f::oracle_utils;

	#[test]
	fun test_to_target_decimal_value_up_and_down() {
		let v = 12345u256;
		let up = oracle_utils::to_target_decimal_value(v, 2, 5);
		let down = oracle_utils::to_target_decimal_value(v, 5, 2);
		assert!(up == 12345000u256, 72000);
		assert!(down == 123u256, 72001);
	}

	#[test]
	fun test_calculate_amplitude_basic() {
		let a = oracle_utils::calculate_amplitude(1000u256, 1100u256);
		assert!(a == 100u64, 72002);
		let b = oracle_utils::calculate_amplitude(0u256, 0u256);
		assert!(b == 18446744073709551615u64, 72003);
	}
}
