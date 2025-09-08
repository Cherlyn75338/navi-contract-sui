import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";

const PACKAGES = [
  "0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f",
  "0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1",
  "0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83",
];

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

async function main() {
  for (const pkg of PACKAGES) {
    console.log(`\n=== Package ${pkg} ===`);
    try {
      const mods = await client.getNormalizedMoveModulesByPackage({ package: pkg });
      for (const [modName, mod] of Object.entries(mods)) {
        const fns = (mod as any).exposedFunctions as Record<string, any>;
        if (!fns) continue;
        const entries = Object.entries(fns).filter(([_, f]) => (f as any).isEntry === true);
        if (entries.length === 0) continue;
        console.log(`Module ${modName}`);
        for (const [fnName, fn] of entries) {
          const params = (fn as any).parameters as any[];
          const typeParams = (fn as any).typeParameters as any[];
          const entrySig = params?.map((p) => typeof p === "string" ? p : JSON.stringify(p)).join(", ") || "";
          console.log(`  entry ${fnName}(${entrySig}) typeParams=${typeParams?.length || 0}`);
        }
      }
    } catch (e) {
      console.error("Error fetching modules for", pkg, e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
