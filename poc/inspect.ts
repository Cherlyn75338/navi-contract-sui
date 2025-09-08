import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

const PACKAGES = [
  "0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f",
  "0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1",
  "0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83",
];

const TARGET_MODULES = new Set(["lending", "pool", "incentive_v2", "incentive_v3", "storage", "validation", "logic"]);

function fmtParams(p: any[]): string {
  return p.map((x) => {
    if (typeof x === "string") return x;
    if (x?.Struct) return `${x.Struct.address}::${x.Struct.module}::${x.Struct.name}`;
    if (x?.Reference) return `&${fmtParams([x.Reference])}`;
    if (x?.MutableReference) return `&mut ${fmtParams([x.MutableReference])}`;
    if (x?.Vector) return `vector<${fmtParams([x.Vector])}>`;
    return JSON.stringify(x);
  }).join(", ");
}

async function run() {
  for (const pkg of PACKAGES) {
    const mods = await client.getNormalizedMoveModulesByPackage({ package: pkg });
    console.log(`\nPackage ${pkg}`);
    for (const [name, mod] of Object.entries(mods)) {
      if (!TARGET_MODULES.has(name)) continue;
      console.log(`  Module ${name}`);
      for (const [fname, fdef] of Object.entries((mod as any).exposedFunctions)) {
        if (!(fdef as any).isEntry) continue;
        const params = (fdef as any).parameters || [];
        const typeParams = (fdef as any).typeParameters || [];
        const hasLiquidation = /liquid/i.test(fname);
        console.log(`    entry ${fname}(${fmtParams(params)}) <${typeParams.length} tparams>${hasLiquidation ? " [liquidation]" : ""}`);
      }
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

