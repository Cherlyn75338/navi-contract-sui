import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

const STORAGE_ID = "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe";

async function main() {
  const obj = await client.getObject({ id: STORAGE_ID, options: { showContent: true, showType: true, showDisplay: true, showBcs: true } });
  console.log(JSON.stringify(obj, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
