# POC: Oracle decimal mismatch probe (Track A)

## Setup

1) Install deps

```
npm i
```

2) Fill placeholders in `src/config.ts`:
- `storageObjectId`, `poolObjectId`, `oracleObjectId`
- module names if different from defaults
- function names if different from defaults
- `ASSETS` coin types and `BORROWERS`

3) Run discovery (list modules/functions)

```
npx ts-node src/discover.ts
```

4) Run valuation check (HF/value path deltas)

```
npx ts-node src/trackA.ts
```

5) Run liquidation dev-inspect (compare seized vs normalized)

```
npx ts-node src/liquidationCheck.ts
```

Notes:
- All scripts are read-only via devInspect.
- Adjust argument shapes after inspecting ABI via discover.ts output.