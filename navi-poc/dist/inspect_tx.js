import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const DIGEST = String(process.argv[2]);
if (!DIGEST) {
    console.error("usage: ts-node inspect_tx.ts <tx_digest>");
    process.exit(1);
}
function toB64(b) {
    try {
        return b || Buffer.from(b).toString("base64");
    }
    catch {
        return String(b);
    }
}
async function main() {
    const tx = await client.getTransactionBlock({ digest: DIGEST, options: { showInput: true, showRawInput: true } });
    const inp = tx.transaction?.data;
    console.log(JSON.stringify(inp, null, 2));
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=inspect_tx.js.map