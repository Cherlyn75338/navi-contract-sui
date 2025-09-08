import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const RESERVES_TABLE_ID = "0xe6d4c6610b86ce7735ea754596d71d72d10c7980b5052fc3c8cdf8d09fea9b4b";

async function main() {
  const fields = await client.getDynamicFields({ parentId: RESERVES_TABLE_ID, limit: 500 });
  const coinTypes: string[] = [];
  const idToCoin: Record<string, string> = {};

  for (const f of fields.data) {
    const obj = await client.getDynamicFieldObject({ parentId: RESERVES_TABLE_ID, name: f.name as any });
    const value = (obj.data as any)?.content?.fields?.value;
    if (value && value.fields && value.fields.coin_type) {
      const coin = value.fields.coin_type as string;
      const assetId = String(value.fields.id);
      coinTypes.push(coin);
      idToCoin[assetId] = coin;
    }
  }

  const set = new Set(coinTypes);
  console.log("total reserves:", coinTypes.length, "unique coin_types:", set.size);
  const counts: Record<string, number> = {};
  for (const c of coinTypes) counts[c] = (counts[c] || 0) + 1;
  const dups = Object.entries(counts).filter(([, n]) => n > 1);
  if (dups.length === 0) {
    console.log("No duplicate coin_type across asset ids.");
  } else {
    console.log("Duplicates:");
    for (const [c, n] of dups) console.log(n, c);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
