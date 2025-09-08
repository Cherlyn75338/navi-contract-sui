import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const POOL_ID = process.argv[2] || "0x96df0fce3c471489f4debaaa762cf960b3d97820bd1f3f025ff8190730e958c5";
async function main() {
    const obj = await client.getObject({ id: POOL_ID, options: { showType: true, showContent: true } });
    console.log(JSON.stringify(obj, null, 2));
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=inspect_pool.js.map