import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const PACKAGES = [
  "0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f",
  "0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1",
];

async function run() {
  for (const pkg of PACKAGES) {
    const mods = await client.getNormalizedMoveModulesByPackage({ package: pkg });
    console.log(`\n=== Package ${pkg} ===`);
    for (const [modName, mod] of Object.entries(mods)) {
      const fns = (mod as any).exposedFunctions as Record<string, any>;
      if (!fns) continue;
      const entries = Object.entries(fns).filter(([_, f]) => (f as any).isEntry === true);
      if (entries.length === 0) continue;
      console.log(`\nModule ${modName}`);
      for (const [fnName, fn] of entries) {
        const body = (fn as any).body as any[] | undefined;
        console.log(`entry ${fnName}: hasBody=${!!body} params=${JSON.stringify((fn as any).parameters)}`);
        if (body) {
          const text = JSON.stringify(body);
          const hasTypeName = text.includes("type_name") || text.includes("TypeName");
          const hasPauseRead = text.includes("paused");
          const hasUidCheck = text.includes("uid_to_address") || text.includes("pool::uid");
          console.log(`  signals: type_name=${hasTypeName} paused=${hasPauseRead} uidCheck=${hasUidCheck}`);
        }
      }
    }
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
