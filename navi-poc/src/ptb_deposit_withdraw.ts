import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

const PKG = "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca";
const CLOCK_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";
const STORAGE = { id: "0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe", v: "8202844" };
const POOL_SUI = { id: "0x96df0fce3c471489f4debaaa762cf960b3d97820bd1f3f025ff8190730e958c5", v: "8202845" };
const INCENTIVE = { id: "0xaaf735bf83ff564e1b219a0d644de894ef5bdc4b2250b126b2a46dd002331821", v: "8202844" };
const ORACLE = { id: "0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f", v: "56016849" };
const SENDER = "0x8cc8d18733a4bf98de8f861d356e2191918733e3afff29f327a01b5ba2997a4d";

async function runDepositWithdraw(assetIndex: number, amount: bigint) {
  const tx = new Transaction();
  const coin = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);

  // deposit
  tx.moveCall({
    target: `${PKG}::lending::deposit`,
    typeArguments: ["0x2::sui::SUI"],
    arguments: [
      tx.sharedObjectRef({ objectId: CLOCK_ID, initialSharedVersion: "1", mutable: false }),
      tx.sharedObjectRef({ objectId: STORAGE.id, initialSharedVersion: STORAGE.v, mutable: true }),
      tx.sharedObjectRef({ objectId: POOL_SUI.id, initialSharedVersion: POOL_SUI.v, mutable: true }),
      tx.pure.u8(assetIndex),
      coin,
      tx.pure.u64(amount),
      tx.sharedObjectRef({ objectId: INCENTIVE.id, initialSharedVersion: INCENTIVE.v, mutable: true }),
    ],
  });

  // withdraw immediately in same PTB
  tx.moveCall({
    target: `${PKG}::lending::withdraw`,
    typeArguments: ["0x2::sui::SUI"],
    arguments: [
      tx.sharedObjectRef({ objectId: CLOCK_ID, initialSharedVersion: "1", mutable: false }),
      tx.sharedObjectRef({ objectId: ORACLE.id, initialSharedVersion: ORACLE.v, mutable: false }),
      tx.sharedObjectRef({ objectId: STORAGE.id, initialSharedVersion: STORAGE.v, mutable: true }),
      tx.sharedObjectRef({ objectId: POOL_SUI.id, initialSharedVersion: POOL_SUI.v, mutable: true }),
      tx.pure.u8(assetIndex),
      tx.pure.u64(amount),
      tx.pure.address(SENDER),
      tx.sharedObjectRef({ objectId: INCENTIVE.id, initialSharedVersion: INCENTIVE.v, mutable: true }),
    ],
  });

  const sim = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
  return sim;
}

async function main() {
  const amount = 1_000_000n; // 0.001 SUI
  const sim = await runDepositWithdraw(0, amount);
  const status = (sim.effects as any)?.status?.status || (sim.effects as any)?.status;
  console.log(`status=${status}`);
  const err = (sim.effects as any)?.status?.error || (sim as any)?.error;
  if (err) console.log(`error=${err}`);
  console.log(`events=${sim.events?.length || 0}`);
  for (const ev of sim.events?.slice(0, 10) || []) {
    console.log(` - ${ev.type}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

