import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

const PACKAGES = [
  "0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f",
  "0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1",
  "0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83",
];

async function listModules(pkg: string) {
  const normalized = await client.getNormalizedMoveModulesByPackage({ package: pkg });
  const moduleNames = Object.keys(normalized);
  console.log(`\nPackage: ${pkg}`);
  for (const moduleName of moduleNames) {
    const mod: any = (normalized as any)[moduleName];
    const fns = Object.keys(mod.exposedFunctions || {});
    const convertLike = fns.filter((f) => /convert|normal|unnormal|decimal/i.test(f));
    const entryFns = fns.filter((f) => mod.exposedFunctions[f]?.isEntry);
    console.log(`  Module: ${moduleName}`);
    if (convertLike.length) console.log(`    convert-like: ${convertLike.join(", ")}`);
    if (entryFns.length) console.log(`    entry: ${entryFns.join(", ")}`);
  }
}

(async () => {
  for (const p of PACKAGES) {
    try {
      await listModules(p);
    } catch (e) {
      console.error(`Error listing modules for ${p}:`, (e as any)?.message ?? e);
    }
  }
})();
