import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
// Hard-coded module package addresses observed in normalized modules output.
const PKG_ADDR = "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca";
async function findRecentSample(module, func) {
    const res = await client.queryTransactionBlocks({
        filter: { MoveFunction: { package: PKG_ADDR, module, function: func } },
        options: { showObjectChanges: true, showEffects: true, showInput: true },
        limit: 20,
        order: "descending",
    });
    return res.data;
}
function extractLikelyObjects(objChanges) {
    const out = {};
    for (const ch of objChanges || []) {
        const type = ch.type || ch.objectType;
        const objId = ch.objectId;
        const objType = ch.objectType || ch.type;
        if (!objType || !objId)
            continue;
        if (objType.includes("::storage::Storage")) {
            (out.storage || (out.storage = [])).push({ id: objId, type: objType });
        }
        if (objType.includes("::pool::Pool<")) {
            (out.pool || (out.pool = [])).push({ id: objId, type: objType });
        }
        if (objType.includes("::incentive::Incentive") || objType.includes("::incentive_v2::Incentive") || objType.includes("::incentive_v3::Incentive")) {
            (out.incentive || (out.incentive = [])).push({ id: objId, type: objType });
        }
        if (objType.includes("::oracle::PriceOracle")) {
            (out.oracle || (out.oracle = [])).push({ id: objId, type: objType });
        }
    }
    return out;
}
async function main() {
    const funcs = [
        { module: "lending", func: "deposit" },
        { module: "lending", func: "withdraw" },
        { module: "incentive_v3", func: "entry_deposit" },
        { module: "incentive_v3", func: "entry_withdraw" },
    ];
    for (const f of funcs) {
        const txs = await findRecentSample(f.module, f.func);
        console.log(`Function: ${PKG_ADDR}::${f.module}::${f.func}  tx_count=${txs.length}`);
        for (const tx of txs) {
            const objCh = tx.objectChanges || [];
            const e = extractLikelyObjects(objCh);
            const nonEmpty = Object.keys(e).filter((k) => e[k]?.length);
            if (nonEmpty.length) {
                console.log(`  tx ${tx.digest}`);
                for (const k of nonEmpty) {
                    const arr = e[k];
                    console.log(`    ${k}:`);
                    for (const it of arr.slice(0, 3)) {
                        console.log(`      - ${it.id}  ${it.type}`);
                    }
                }
            }
        }
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=sample.js.map