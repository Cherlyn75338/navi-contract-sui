import { SuiClient } from '@mysten/sui.js/client';

const PKG_STORAGE = '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';
const PKG_INCENTIVE = '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1';
// const PKG_ORACLE = '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83';

async function run() {
  const c = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });

  // Try v3; if none, fallback to incentive_v2 entry_repay (common) to harvest shared objects and coin type
  let tx = null as any;
  for (const [module, func] of [['incentive_v3','entry_borrow'], ['incentive_v3','entry_repay'], ['incentive_v2','entry_borrow'], ['incentive_v2','entry_repay']]) {
    const txs = await c.queryTransactionBlocks({
      filter: { MoveFunction: { package: PKG_INCENTIVE, module, function: func } },
      options: { showInput: true, showEffects: true },
      limit: 1,
      order: 'descending'
    });
    if (txs.data.length) { tx = txs.data[0]; break; }
  }
  if (!tx) { console.log('No suitable incentive txs found'); return; }
  console.log('Sample tx digest:', tx.digest);

  const shared = tx.effects?.sharedObjects || [];
  const ids = shared.map((s) => s.objectId);
  const objs = await c.multiGetObjects({ ids, options: { showType: true } });
  const typed = objs.map((o) => ({ id: o.data?.objectId, type: o.data?.type }));
  console.log('Shared objects in tx:', typed);

  // Extract coin type argument from the MoveCall
  const prog = tx.transaction?.data.transaction as any;
  let coinType = '';
  if (prog?.kind === 'ProgrammableTransaction') {
    const moveCalls = (prog.transactions || []).filter((t: any) => 'MoveCall' in t).map((t: any) => t.MoveCall);
    const borrowCall = moveCalls.find((m: any) => m.function === 'entry_borrow');
    if (borrowCall?.type_arguments?.length) coinType = borrowCall.type_arguments[0];
  }
  console.log('Coin type (from tx):', coinType);

  // Identify storage/pool/oracle/incentive by type suffix
  const storage = typed.find((t) => t.type?.endsWith('::storage::Storage'));
  const pool = typed.find((t) => t.type?.includes('::pool::Pool<'));
  const oracle = typed.find((t) => t.type?.endsWith('::oracle::PriceOracle') || t.type?.endsWith('::oracle_pro::PriceOracle'));
  const incentive = typed.find((t) => t.type?.endsWith('::incentive_v3::Incentive') || t.type?.endsWith('::incentive_v2::Incentive'));

  console.log('Discovered STORAGE_ID:', storage?.id);
  console.log('Discovered POOL_ID:', pool?.id, 'type:', pool?.type);
  console.log('Discovered ORACLE_ID:', oracle?.id);
  console.log('Discovered INCENTIVE_ID:', incentive?.id, 'type:', incentive?.type);
}

run().catch(console.error);

