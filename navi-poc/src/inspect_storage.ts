import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

const STORAGE_ID = "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe";

async function main() {
  const fields = await client.getDynamicFields({ parentId: STORAGE_ID, limit: 200 });
  console.log(`dynamic fields count=${fields.data.length}`);
  for (const f of fields.data) {
    console.log(`nameType=${(f as any).name?.type || "?"}`);
    console.log(`  nameVal=${JSON.stringify((f as any).name?.value)}`);
    console.log(`  objectId=${f.objectId}`);
    try {
      const o = await client.getObject({ id: f.objectId, options: { showType: true, showContent: true } });
      console.log(`  child type=${(o.data as any)?.type}`);
    } catch (e) {
      console.log(`  child fetch error: ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

