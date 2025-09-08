import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

const PACKAGES = [
  "0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f",
  "0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1",
  "0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83",
];

const CANDIDATE_FUNCS: Array<{ module: string; function: string }> = [
  { module: "lending", function: "deposit" },
  { module: "lending", function: "withdraw" },
  { module: "lending", function: "borrow" },
  { module: "lending", function: "repay" },
  { module: "lending", function: "liquidation_call" },
  { module: "incentive_v2", function: "entry_deposit" },
  { module: "incentive_v2", function: "entry_withdraw" },
  { module: "incentive_v3", function: "entry_deposit" },
  { module: "incentive_v3", function: "entry_withdraw" },
];

function extractPoolType(typeStr: string): string | null {
  const idx = typeStr.indexOf("::pool::Pool<");
  if (idx === -1) return null;
  const start = typeStr.indexOf("<", idx);
  const end = typeStr.lastIndexOf(">");
  if (start === -1 || end === -1 || end <= start) return null;
  return typeStr.slice(start + 1, end);
}

async function scan() {
  for (const pkg of PACKAGES) {
    const poolTypeToIds = new Map<string, Set<string>>();
    const storageIds = new Set<string>();

    for (const { module, function: fn } of CANDIDATE_FUNCS) {
      try {
        const q = await client.queryTransactionBlocks({
          filter: { MoveFunction: { package: pkg as any, module, function: fn } },
          options: { showObjectChanges: true },
          limit: 50,
          order: "descending",
        });
        for (const tx of q.data) {
          const changes = tx.objectChanges || [];
          for (const ch of changes) {
            if (ch.type === "mutated" || ch.type === "created") {
              const t = (ch as any).objectType as string | undefined;
              if (!t) continue;
              if (t.includes("::storage::Storage")) {
                storageIds.add((ch as any).objectId);
              }
              if (t.includes("::pool::Pool<")) {
                const poolType = extractPoolType(t);
                if (!poolType) continue;
                const id = (ch as any).objectId as string;
                if (!poolTypeToIds.has(poolType)) poolTypeToIds.set(poolType, new Set());
                poolTypeToIds.get(poolType)!.add(id);
              }
            }
          }
        }
      } catch (e) {
        // Ignore modules not present in a package
      }
    }

    console.log(`\n=== Package ${pkg} ===`);
    console.log(`Storage object IDs seen (mutated/created): ${[...storageIds].join(", ") || "<none>"}`);
    if (poolTypeToIds.size === 0) {
      console.log("No pool mutations found in recent txs.");
    }
    for (const [poolType, ids] of poolTypeToIds.entries()) {
      const idList = [...ids];
      const multi = idList.length > 1 ? "MULTI" : "SINGLE";
      console.log(`Pool<${poolType}>: ${multi} ids=${idList.join(", ")}`);
    }
  }
}

scan().catch((e) => { console.error(e); process.exit(1); });
