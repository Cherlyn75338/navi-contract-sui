## Living, test-driven audit checklist (Sui Move lending core)

This checklist is tailored to this codebase and paired with unit/property tests. Keep it updated as the protocol evolves.

### Scope
- lending core: `lending_core::{storage,pool,logic,validation,calculator,dynamic_calculator,account,flash_loan,constants,error,version,incentive,incentive_v2,incentive_v3,lending}`
- math: `math::{ray_math,safe_math}`
- oracle: `oracle::{oracle,oracle_utils,config,oracle_constants,oracle_version,oracle_error,oracle_provider,oracle_pro,oracle_dynamic_getter,adaptor_pyth,adaptor_supra,strategy}`
- utils: `utils::utils`

### Entry points and shared objects to audit
- Entry functions in `incentive_v2` and `incentive_v3` for deposit/withdraw/borrow/repay/liquidation and reward claims
- Deprecated entries in `lending` must be gated or disabled
- Flash loan flows: `flash_loan_*` and `flash_repay_*`
- Oracle update/getter functions (externally influenced state)

### Global invariants (prove/guard in tests or code)
- Version and pause gates enforced on all mutating entry paths
- Storage: indexes/timestamps monotone; caps enforced with correct scales; totals consistent with user states
- Oracle: prices fresh, within bounds, decimals normalized before use
- Incentives: indices and paid maps updated atomically; no double-claim; non-negative and bounded rewards
- Flash loans: non-zero fees for non-zero loans; receipt single-use; exact asset/pool binding

### Move-specific vulnerability themes
- Generic type misuse: enforce coin type equality to stored metadata
- Improper access control on shared objects and on-behalf flows
- Math precision/overflow: RAY/WAD/decimal conversions, rounding loss to zero, cumulative bias, divide-by-zero
- Oracle manipulation/staleness and decimal coercion errors
- Resource/account registration, unbounded iteration/DoS, storage/index desync

### Math/units checklist
- Define and document units for: `ltv`, `threshold`, `bonus`, `*_rate`, `*_index`, `treasury_factor`, `FlashLoanMultiple`
- Validate conversions: `ray_to_wad`, `wad_to_ray`, pool `convert_amount`, `normal_amount`, `unnormal_amount`
- Bound rounding error: prove round-trip identity where scale-compatible; quantify loss otherwise
- Guard arithmetic with `safe_math` or explicit asserts; test boundary failures

