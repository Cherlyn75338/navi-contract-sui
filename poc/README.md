# Sui PoC: Asset ↔ CoinType ↔ Pool Mismatch

- Track A (static): enumerate modules/structs/functions to verify pool binding.
- Track B (mainnet sim): enumerate on-chain objects, group `Pool<T>`, and optionally devInspect a cross-pool deposit/withdraw.

Requirements:
- Node.js LTS
- `npm i`

Scripts:
- `npm run track:a`
- `npm run track:b`

Environment for Track B devInspect (optional):
- `POC_RUN_DEV_INSPECT=1`
- `POC_SIGNER=<0x... sender address>`
- `POC_COIN_ID=<coin object id for T>`
- `POC_STORAGE_ID=<storage object id>`
- `POC_POOL_A=<pool object id>`
- `POC_POOL_B=<pool object id>`
- `POC_ASSET_ID=<u8 asset id>`
- `POC_COIN_TYPE=<fully qualified T, e.g., 0x2::sui::SUI>`
- Optional: `POC_ORACLE_ID=<oracle object id>`

Notes:
- Uses mainnet RPC and devInspect only (no on-chain changes).
- Track B prints discovered pools/storages, and attempts a dry-run cross-pool call if env vars are set.