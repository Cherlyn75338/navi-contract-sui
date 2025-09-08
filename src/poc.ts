import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { SuiGraphQLClient } from '@mysten/sui.js/graphql';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const PACKAGES = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83',
];

const MODULES = ['lending', 'flash_loan'];

async function getModuleInfo(pkg: string, module: string) {
  try {
    const m = await client.getNormalizedMoveModule({ package: pkg, module });
    return m;
  } catch (e: any) {
    return null;
  }
}

function hasEntryWrapper(mod: any): boolean {
  if (!mod) return false;
  for (const [fn, def] of Object.entries<any>(mod.exposedFunctions || {})) {
    if (def.isEntry) {
      // Heuristic: look for flash_loan_with_ctx in body is not available via normalized; we only flag presence of entries
      return true;
    }
  }
  return false;
}

function getReceiptAbilities(mod: any) {
  if (!mod) return null;
  const s = (mod.structs as any)['Receipt'];
  if (!s) return null;
  return s.abilities; // { hasCopy, hasDrop, hasStore, hasKey }
}

async function main() {
  console.log('Phase 1: normalized module checks');
  for (const pkg of PACKAGES) {
    for (const modName of MODULES) {
      const mod = await getModuleInfo(pkg, modName);
      if (!mod) {
        console.log(`- ${pkg}::${modName} not found`);
        continue;
      }
      const funcs = mod.exposedFunctions || {};
      const f1 = funcs['flash_loan_with_ctx'];
      const f2 = funcs['flash_repay_with_ctx'];
      const repayFriend = funcs['repay'];
      const abilities = getReceiptAbilities(mod);
      console.log(`- ${pkg}::${modName}`);
      if (f1) console.log(`  flash_loan_with_ctx: visibility=${f1.visibility} entry=${f1.isEntry}`);
      if (f2) console.log(`  flash_repay_with_ctx: visibility=${f2.visibility} entry=${f2.isEntry}`);
      if (repayFriend) console.log(`  repay: visibility=${repayFriend.visibility} entry=${repayFriend.isEntry}`);
      if (abilities) console.log(`  Receipt abilities: copy=${abilities.hasCopy} drop=${abilities.hasDrop} store=${abilities.hasStore} key=${abilities.hasKey}`);
      console.log(`  any entry wrapper present: ${hasEntryWrapper(mod)}`);
    }
  }

  console.log('\nPhase 2: discover shared objects (manual step)');
  console.log('- Attempting automatic discovery of Config (via events), Storage & Pool (via tx scans).');

  let CONFIG_ID = process.env.FL_CONFIG_ID || '';
  let POOL_ID = process.env.FL_POOL_ID || '';
  let STORAGE_ID = process.env.STORAGE_ID || '';
  const CLOCK_ID = process.env.CLOCK_ID || '0x6'; // mainnet clock object id is 0x6
  const COIN_TYPE = process.env.COIN_TYPE || '0x2::sui::SUI';
  const PKG_LENDING = process.env.PKG_LENDING || PACKAGES[0];
  const PKG_FLASH = process.env.PKG_FLASH || PACKAGES[0];
  const SENDER = process.env.SENDER || '0x0'; // devInspect requires any address
  const GQL = new SuiGraphQLClient({ url: process.env.SUI_GRAPHQL_URL || 'https://sui-mainnet.mystenlabs.com/graphql' });

  // Try discover CONFIG_ID from flash_loan::ConfigCreated events
  if (!CONFIG_ID) {
    try {
      const ev = await client.queryEvents({ query: { MoveModule: { package: PKG_FLASH, module: 'flash_loan' } }, limit: 50 });
      const cfg = ev.data.find((e) => e.type.endsWith('::flash_loan::ConfigCreated')) as any;
      if (cfg && cfg.parsedJson && cfg.parsedJson.id) {
        CONFIG_ID = cfg.parsedJson.id as string;
        console.log(`Discovered Config id: ${CONFIG_ID}`);
      }
    } catch {}
  }

  // Try GraphQL objects by type for Config/Storage/Pool
  async function findObjectByType(type: string): Promise<string | null> {
    try {
      const result: any = await GQL.query({
        query: /* GraphQL */ `
          query ObjByType($type: String!) {
            objects(filter: { type: $type }, first: 5) {
              nodes { objectId owner type }
            }
          }
        `,
        variables: { type },
      });
      const nodes = result?.data?.objects?.nodes || [];
      const shared = nodes.find((n: any) => n.owner?.Shared) || nodes.find((n: any) => n.owner === 'Shared' || typeof n.owner === 'object');
      return (shared && shared.objectId) || (nodes[0] && nodes[0].objectId) || null;
    } catch {
      return null;
    }
  }

  if (!CONFIG_ID) {
    CONFIG_ID = (await findObjectByType(`${PKG_FLASH}::flash_loan::Config`)) || CONFIG_ID;
    if (CONFIG_ID) console.log(`Discovered via GraphQL Config id: ${CONFIG_ID}`);
  }
  if (!STORAGE_ID) {
    STORAGE_ID = (await findObjectByType(`${PKG_LENDING}::storage::Storage`)) || STORAGE_ID;
    if (STORAGE_ID) console.log(`Discovered via GraphQL Storage id: ${STORAGE_ID}`);
  }
  if (!POOL_ID) {
    POOL_ID = (await findObjectByType(`${PKG_LENDING}::pool::Pool<${COIN_TYPE}>`)) || POOL_ID;
    if (POOL_ID) console.log(`Discovered via GraphQL Pool id: ${POOL_ID}`);
  }

  // Try discover STORAGE_ID & POOL_ID by scanning recent lending txs
  async function discoverFrom(func: string) {
    try {
      const txs = await client.queryTransactionBlocks({
        filter: { MoveFunction: { package: PKG_LENDING, module: 'lending', function: func } },
        limit: 20,
        order: 'descending',
        options: { showObjectChanges: true },
      } as any);
      for (const t of txs.data) {
        if (!t.digest) continue;
        const oc = (t.objectChanges || []) as any[];
        for (const c of oc) {
          const tp = (c as any).objectType as string | undefined;
          if (!tp) continue;
          if (!STORAGE_ID && tp.endsWith('::storage::Storage')) {
            STORAGE_ID = (c as any).objectId;
          }
          if (!POOL_ID && tp.includes('::pool::Pool<')) {
            // Prefer matching desired coin type
            if (tp.includes(`<${COIN_TYPE}>`)) {
              POOL_ID = (c as any).objectId;
            } else if (!POOL_ID) {
              POOL_ID = (c as any).objectId;
            }
          }
        }
        if (STORAGE_ID && POOL_ID) break;
      }
    } catch {}
  }

  if (!STORAGE_ID || !POOL_ID) {
    await discoverFrom('deposit_coin');
  }
  if (!STORAGE_ID || !POOL_ID) {
    await discoverFrom('repay_coin');
  }
  if (!STORAGE_ID || !POOL_ID) {
    await discoverFrom('withdraw_coin');
  }

  // Try discover via direct flash_loan_with_ctx calls (best source)
  if (!POOL_ID || !CONFIG_ID) {
    try {
      const txs = await client.queryTransactionBlocks({
        filter: { MoveFunction: { package: PKG_LENDING, module: 'lending', function: 'flash_loan_with_ctx' } },
        limit: 20,
        order: 'descending',
        options: { showInput: true },
      } as any);
      for (const t of txs.data) {
        const txd: any = t;
        const calls = (txd.transaction?.data?.transaction?.kind === 'ProgrammableTransaction')
          ? txd.transaction.data.transaction.inputs
          : null;
        // Alternatively parse commands list for MoveCall targets and arguments
        const commands = txd.transaction?.data?.transaction?.kind === 'ProgrammableTransaction'
          ? txd.transaction.data.transaction.commands
          : [];
        for (const cmd of commands || []) {
          if (cmd.MoveCall && cmd.MoveCall.module === 'lending' && cmd.MoveCall.function === 'flash_loan_with_ctx') {
            const args = cmd.MoveCall.arguments;
            // expected: [config, &mut pool, amount]
            if (args && args.length >= 2) {
              const a0 = args[0];
              const a1 = args[1];
              if (typeof a0 === 'object' && a0.Object && a0.Object.ImmOrOwnedObject) {
                CONFIG_ID = a0.Object.ImmOrOwnedObject.objectId;
              }
              if (typeof a1 === 'object' && a1.Object && a1.Object.SharedObject) {
                POOL_ID = a1.Object.SharedObject.objectId;
              }
            }
          }
        }
        if (CONFIG_ID && POOL_ID) break;
      }
    } catch {}
  }

  if (CONFIG_ID) console.log(`CONFIG_ID=${CONFIG_ID}`);
  if (STORAGE_ID) console.log(`STORAGE_ID=${STORAGE_ID}`);
  if (POOL_ID) console.log(`POOL_ID=${POOL_ID}`);

  if (!CONFIG_ID || !POOL_ID || !STORAGE_ID) {
    console.log('Skipping Phase 3-5 (devInspect) because required object ids are not set.');
    console.log('Set env: FL_CONFIG_ID, FL_POOL_ID, STORAGE_ID, optionally PKG_LENDING, PKG_FLASH, COIN_TYPE, SENDER.');
    return;
  }

  console.log('\nPhase 3: devInspect no-repay attempt');
  {
    const tx = new TransactionBlock();
    const [balance, receipt] = tx.moveCall({
      target: `${PKG_LENDING}::lending::flash_loan_with_ctx`,
      typeArguments: [COIN_TYPE],
      arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure.u64('1')],
    });

    // Try convert balance to coin and transfer to sender
    // Some chains require from_balance(balance, &mut ctx); we use std signature
    const coin = tx.moveCall({
      target: `0x2::coin::from_balance`,
      typeArguments: [COIN_TYPE],
      arguments: [balance],
    });

    tx.transferObjects([coin], tx.pure.address(SENDER));

    const res = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
    console.log(JSON.stringify(res, null, 2));
  }

  console.log('\nPhase 4: devInspect immediate repay');
  {
    const tx = new TransactionBlock();
    const [balance, receipt] = tx.moveCall({
      target: `${PKG_LENDING}::lending::flash_loan_with_ctx`,
      typeArguments: [COIN_TYPE],
      arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure.u64('1')],
    });

    // Repay directly; fees likely zero for tiny amount.
    const remaining = tx.moveCall({
      target: `${PKG_LENDING}::lending::flash_repay_with_ctx`,
      typeArguments: [COIN_TYPE],
      arguments: [tx.object(CLOCK_ID), tx.object(STORAGE_ID), tx.object(POOL_ID), receipt, balance],
    });

    tx.transferObjects([remaining], tx.pure.address(SENDER));
    const res = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
    console.log(JSON.stringify(res, null, 2));
  }

  console.log('\nPhase 5: fee-floor and splitting');
  {
    const tx = new TransactionBlock();
    const [balance, receipt] = tx.moveCall({
      target: `${PKG_LENDING}::lending::flash_loan_with_ctx`,
      typeArguments: [COIN_TYPE],
      arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure.u64('1')],
    });

    const parsed = tx.moveCall({
      target: `${PKG_FLASH}::flash_loan::parsed_receipt`,
      typeArguments: [COIN_TYPE],
      arguments: [receipt],
    });

    // Repay to consume
    const remaining = tx.moveCall({
      target: `${PKG_LENDING}::lending::flash_repay_with_ctx`,
      typeArguments: [COIN_TYPE],
      arguments: [tx.object(CLOCK_ID), tx.object(STORAGE_ID), tx.object(POOL_ID), receipt, balance],
    });

    tx.transferObjects([remaining], tx.pure.address(SENDER));
    const res = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
    console.log(JSON.stringify(res, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
