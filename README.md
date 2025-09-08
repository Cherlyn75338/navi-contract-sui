# navi mainnet sui contract

Code from explorer

## Explorer

* [lending_core](https://suivision.xyz/package/0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f?tab=Code)
* [math](https://suivision.xyz/package/0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1?tab=Code)
* [oracle](https://suivision.xyz/package/0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83?tab=Code)
* [utils](https://suivision.xyz/package/0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1?tab=Code)

## Interface

* <https://github.com/naviprotocol/protocol-interface>

## Running tests (Sui CLI)

Prereqs: Install Sui CLI from the official docs (`https://docs.sui.io/build/install`). Then:

```bash
cd lending_core
sui move test
```

To run a specific test in the harness module:

```bash
sui move test --filter test_liquidation_truncation
```

Notes:
- `lending_core/tests/test_harness.move` includes skeleton helpers and tests for the liquidation truncation PoC.
- `test_event_price_mismatch` is marked `expected_failure` by default; remove the attribute when you provide oracle feeder/admin caps in the test environment.

## One‑liner to reconfirm narrowing cast on any package id (TypeScript)

Save this script as `checkCast.ts` and run with Node 18+ after `npm i @mysten/sui.js`.

```ts
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
const pkg = process.argv[2];

function hasCast(text: string) {
  const castThenUnnorm = /unnormal_amount\s*<[^>]+>\s*\(\s*\w+\s*,\s*\w+\s+as\s+u64\s*\)/i;
  const directCast = /\bas\s+u64\b/i;
  const unnorm = /unnormal_amount\s*</i;
  return castThenUnnorm.test(text) || (directCast.test(text) && unnorm.test(text));
}

(async () => {
  if (!pkg) {
    console.error('Usage: node checkCast.ts <PACKAGE_ID>');
    process.exit(1);
  }
  const mods = await client.getNormalizedMoveModulesByPackage({ package: pkg });
  let found = false;
  for (const [name, mod] of Object.entries(mods)) {
    const txt = JSON.stringify(mod);
    if (/lending/i.test(name) || /logic/i.test(name)) {
      if (hasCast(txt)) {
        console.log(`[OK] ${pkg} :: ${name} contains as u64 before unnormal_amount`);
        found = true;
      }
    }
  }
  if (!found) console.log(`[WARN] ${pkg} :: pattern not confirmed`);
})();
```

