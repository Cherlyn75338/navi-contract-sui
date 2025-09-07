#[test_only]
module lending_core::flash_loan_fee_tests {
    use lending_core::constants;

    #[test]
    fun test_fee_rounding_zero_possible() {
        let rate_to_supplier: u64 = 1; // 1 / FlashLoanMultiple
        let rate_to_treasury: u64 = 0;
        let amount: u64 = 1; // minimal
        let supplier_fee = amount * rate_to_supplier / constants::FlashLoanMultiple();
        let treasury_fee = amount * rate_to_treasury / constants::FlashLoanMultiple();
        assert!(supplier_fee == 0, 1);
        assert!(treasury_fee == 0, 2);
    }
}

