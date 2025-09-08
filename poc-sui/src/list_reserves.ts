import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

const RESERVES_TABLE_ID = "0xe6d4c6610b86ce7735ea754596d71d72d10c7980b5052fc3c8cdf8d09fea9b4b";

async function main() {
  const fields = await client.getDynamicFields({ parentId: RESERVES_TABLE_ID, limit: 200 });
  console.log("count:", fields.data.length);
  for (const f of fields.data) {
    console.log("field name:", JSON.stringify(f.name));
    try {
      const obj = await client.getDynamicFieldObject({ parentId: RESERVES_TABLE_ID, name: f.name as any });
      const c = (obj.data as any)?.content;
      console.log("value type:", c?.type);
      const keys = c && typeof c === 'object' && 'fields' in c ? Object.keys(c.fields) : null;
      console.log("value fields keys:", keys);
      if (c && c.fields) {
        console.log("value.fields sample:", JSON.stringify(c.fields, null, 2));
      }
    } catch (e) {
      console.error("getDynamicFieldObject error", e);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
