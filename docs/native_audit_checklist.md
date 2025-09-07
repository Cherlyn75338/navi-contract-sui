## Native-side audit checklist (to implement/verify in native code)

- Access control and pause
  - Enforce global pause gate in all entries that mutate state
  - Verify admin/owner tables for any admin-only calls

- Oracle usage
  - Enforce freshness: now - oracle_ts <= config.max_timestamp_diff
  - Validate price ranges and historical spans per `oracle::strategy`
  - Use normalized decimals once; forbid double-scaling

- Math and scaling
  - All money math in u256; cast at boundaries only
  - Multiply-then-divide ordering to reduce truncation
  - Rounding policy:
    - Fees: ceil and min fee of 1 when amount > 0
    - Withdraw/seize: round protocol-favoring to avoid insolvency
    - Repay: allow dust forgiveness or user-favoring rounding

- Interest / indices
  - Update indices before reads and writes
  - Clamp dt, ensure monotonic clocks, cap extreme accrual

- Liquidation
  - Enforce unhealthy precondition and partial liquidation bounds
  - Fresh prices and consistent scaling for debt/collateral

- Type safety (generics)
  - Assert `TypeName`/TypeInfo of generics match stored types prior to coin ops
  - Never trust human-readable coin names/strings for type enforcement

- State and DoS
  - Avoid loops over global tables/vectors in hot paths
  - O(1) per user action; amortize spread work

- Flash loan
  - Validate receipt matches sender, pool, and amount
  - Apply min/ceil fees with configured rate; enforce max/min amounts

- Upgrade safety
  - Enforce version gates; strong custody of UpgradeCap; review before publish

