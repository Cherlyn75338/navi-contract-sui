import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const PKG = "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca";
const CLOCK_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";
const WITHDRAW_TX = "8V5Yjzbhz3dGYjvyi4iV2PW6SvTiHUNSAGEi1RYZHJPR";
const SENDER = "0x8cc8d18733a4bf98de8f861d356e2191918733e3afff29f327a01b5ba2997a4d";
async function resolveSharedRefsFromWithdraw() {
    const tx = await client.getTransactionBlock({ digest: WITHDRAW_TX, options: { showInput: true } });
    const inputs = tx.transaction?.data?.transaction?.inputs || tx.transaction?.data?.inputs || [];
    const sharedInputs = (inputs || []).filter((i) => i.type === "object" && i.objectType === "sharedObject");
    const ids = sharedInputs.map((i) => ({ id: i.objectId, v: i.initialSharedVersion, mutable: i.mutable }));
    const out = {};
    for (const it of ids) {
        try {
            const obj = await client.getObject({ id: it.id, options: { showType: true } });
            const ty = obj.data?.type;
            if (!ty)
                continue;
            if (ty.includes("::oracle::PriceOracle"))
                out.oracle = { id: it.id, v: it.v, mutable: false };
            else if (ty.includes("::storage::Storage"))
                out.storage = { id: it.id, v: it.v, mutable: true };
            else if (ty.includes("::pool::Pool<0x2::sui::SUI>"))
                out.poolSui = { id: it.id, v: it.v, mutable: true };
            else if (ty.includes("::incentive::Incentive"))
                out.incentive = { id: it.id, v: it.v, mutable: true };
        }
        catch { }
    }
    return out;
}
async function runDepositWithdraw(assetIndex, amount) {
    const shared = await resolveSharedRefsFromWithdraw();
    if (!shared.storage || !shared.poolSui || !shared.incentive || !shared.oracle) {
        throw new Error(`Missing shared refs: ${JSON.stringify(shared)}`);
    }
    const tx = new Transaction();
    const coin = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
    // deposit
    tx.moveCall({
        target: `${PKG}::lending::deposit`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
            tx.sharedObjectRef({ objectId: CLOCK_ID, initialSharedVersion: "1", mutable: false }),
            tx.sharedObjectRef({ objectId: shared.storage.id, initialSharedVersion: shared.storage.v, mutable: true }),
            tx.sharedObjectRef({ objectId: shared.poolSui.id, initialSharedVersion: shared.poolSui.v, mutable: true }),
            tx.pure.u8(assetIndex),
            coin,
            tx.pure.u64(amount),
            tx.sharedObjectRef({ objectId: shared.incentive.id, initialSharedVersion: shared.incentive.v, mutable: true }),
        ],
    });
    // withdraw immediately in same PTB
    tx.moveCall({
        target: `${PKG}::lending::withdraw`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
            tx.sharedObjectRef({ objectId: CLOCK_ID, initialSharedVersion: "1", mutable: false }),
            tx.sharedObjectRef({ objectId: shared.oracle.id, initialSharedVersion: shared.oracle.v, mutable: false }),
            tx.sharedObjectRef({ objectId: shared.storage.id, initialSharedVersion: shared.storage.v, mutable: true }),
            tx.sharedObjectRef({ objectId: shared.poolSui.id, initialSharedVersion: shared.poolSui.v, mutable: true }),
            tx.pure.u8(assetIndex),
            tx.pure.u64(amount),
            tx.pure.address(SENDER),
            tx.sharedObjectRef({ objectId: shared.incentive.id, initialSharedVersion: shared.incentive.v, mutable: true }),
        ],
    });
    const sim = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
    return sim;
}
async function main() {
    const amount = 1000000n; // 0.001 SUI
    const sim = await runDepositWithdraw(0, amount);
    const status = sim.effects?.status?.status || sim.effects?.status;
    console.log(`status=${status}`);
    const err = sim.effects?.status?.error || sim?.error;
    if (err)
        console.log(`error=${err}`);
    console.log(`events=${sim.events?.length || 0}`);
    for (const ev of sim.events?.slice(0, 10) || []) {
        console.log(` - ${ev.type}`);
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=ptb_deposit_withdraw.js.map