#[test_only]
module lending_core::flash_loan_underpay_tests {
    use lending_core::constants;
    use 0x1::math;

    #[test]
    fun test_fee_rounding_to_zero_edges() {
        let denom = constants::FlashLoanMultiple();
        // If amount < denom and rate_to_supplier == 1, fee_to_supplier = 0
        let amount: u64 = denom - 1;
        let rate: u64 = 1;
        let fee = amount * rate / denom;
        assert!(fee == 0, 1);
    }
}

