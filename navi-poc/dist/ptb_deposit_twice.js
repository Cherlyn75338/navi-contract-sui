import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
// Candidate package exposing lending::deposit entry
const PKG = "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca";
// Shared Clock object on Sui mainnet
const CLOCK_ID = "0x6";
// Object IDs inferred from recent lending::deposit transactions (SUI market)
const STORAGE_ID = "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe";
const POOL_SUI_ID = "0x96df0fce3c471489f4debaaa762cf960b3d97820bd1f3f025ff8190730e958c5"; // pool::Pool<0x2::sui::SUI>
const INCENTIVE_ID = "0xaaf735bf83ff564e1b219a0d644de894ef5bdc4b2250b126b2a46dd002331821"; // incentive::Incentive
const SENDER = "0x1111111111111111111111111111111111111111111111111111111111111111";
async function tryDepositTwice(assetIndex) {
    const tx = new Transaction();
    // Split two tiny SUI coins from gas (in MIST)
    const amt1 = 10000000n; // 0.01 SUI
    const amt2 = 10000000n;
    const coin1 = tx.splitCoins(tx.gas, [tx.pure.u64(amt1)]);
    const coin2 = tx.splitCoins(tx.gas, [tx.pure.u64(amt2)]);
    // lending::deposit(&Clock, &mut Storage, &mut Pool<T0>, u8, Coin<T0>, u64, &mut Incentive, &mut TxContext)
    tx.moveCall({
        target: `${PKG}::lending::deposit`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
            tx.object(CLOCK_ID),
            tx.object(STORAGE_ID),
            tx.object(POOL_SUI_ID),
            tx.pure.u8(assetIndex),
            coin1,
            tx.pure.u64(amt1),
            tx.object(INCENTIVE_ID),
        ],
    });
    tx.moveCall({
        target: `${PKG}::lending::deposit`,
        typeArguments: ["0x2::sui::SUI"],
        arguments: [
            tx.object(CLOCK_ID),
            tx.object(STORAGE_ID),
            tx.object(POOL_SUI_ID),
            tx.pure.u8(assetIndex),
            coin2,
            tx.pure.u64(amt2),
            tx.object(INCENTIVE_ID),
        ],
    });
    const res = await client.devInspectTransactionBlock({
        sender: SENDER,
        transactionBlock: tx,
    });
    return res;
}
async function main() {
    for (let idx = 0; idx < 64; idx++) {
        try {
            const sim = await tryDepositTwice(idx);
            const status = sim.effects?.status?.status || sim.effects?.status;
            console.log(`assetIndex=${idx} status=${status}`);
            const err = sim.effects?.status?.error || sim?.error;
            if (err)
                console.log(`  error: ${err}`);
            if ((sim.events || []).length) {
                console.log(`  events: ${sim.events.length}`);
                for (const ev of sim.events.slice(0, 5)) {
                    console.log(`   - ${ev.type}`);
                }
            }
            if (status === "success") {
                break;
            }
        }
        catch (e) {
            console.log(`assetIndex=${idx} error: ${e.message}`);
        }
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=ptb_deposit_twice.js.map