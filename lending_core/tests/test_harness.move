// Test harness skeleton for truncation/cast PoC
// This module provides the requested function signatures and test stubs.
// Implementations are intentionally minimal to allow compiling and local extension.

#[test_only]
module lending_core::test_harness {
    use sui::tx_context::TxContext;
    use sui::clock::Clock;

    // --- Fixtures & helpers (signatures only; bodies abort to be filled in locally) ---

    public fun setup_fixture<T0, T1>(ctx: &mut TxContext): (
        Clock,
        &mut lending_core::storage::Storage,
        &mut lending_core::pool::Pool<T0>,
        &mut lending_core::pool::Pool<T1>,
        &mut oracle::oracle::PriceOracle,
    ) {
        abort 0
    }

    public fun seed_reserve_params<T0, T1>(
        _storage: &mut lending_core::storage::Storage,
        _pool0: &mut lending_core::pool::Pool<T0>,
        _pool1: &mut lending_core::pool::Pool<T1>,
        _decimals0: u8,
        _decimals1: u8,
        _ratio_ray: u256,
        _bonus_ray: u256,
        _treasury_ray: u256,
    ) {
        abort 0
    }

    public fun set_prices(
        _oracle: &mut oracle::oracle::PriceOracle,
        _clock: &Clock,
        _coll_id: u8,
        _coll_price: u256,
        _coll_dec: u8,
        _debt_id: u8,
        _debt_price: u256,
        _debt_dec: u8,
    ) {
        abort 0
    }

    public fun seed_user_huge_position<T0, T1>(
        _storage: &mut lending_core::storage::Storage,
        _user: address,
        _coll_asset: u8,
        _debt_asset: u8,
        _coll_index: u256,
        _debt_index: u256,
        _coll_balance_norm: u256,
        _debt_balance_norm: u256,
    ) {
        abort 0
    }

    // --- Tests ---

    // Test 1: truncation in base_liquidation_call (skeleton)
    #[test]
    fun test_liquidation_truncation(ctx: &mut TxContext) {
        // Intended: construct state so seized_normalized > u64::MAX but coin <= u64::MAX,
        // then emulate cast (as u64) before unnormalize and compare deltas.
        // Fill in locally using the helpers above.
        let _ = ctx; // silence unused param
    }

    // Test 2: event price mismatch potential (skipped by default)
    // Note: requires oracle feeder/admin caps; provide locally if available.
    // Remove expected_failure to enable when caps exist.
    #[test, expected_failure]
    fun test_event_price_mismatch(ctx: &mut TxContext) {
        let _ = ctx;
        abort 1
    }

    // Test 3a: convert_amount overflow (expected failure)
    #[test, expected_failure]
    fun test_convert_amount_overflow(ctx: &mut TxContext) {
        let _ = ctx;
        abort 1
    }

    // Test 3b: convert_amount truncation bias (skeleton)
    #[test]
    fun test_convert_amount_truncation(ctx: &mut TxContext) {
        let _ = ctx;
        // Intended: show up→down (or down→up) conversion loses units for non-multiples of scale.
    }
}

