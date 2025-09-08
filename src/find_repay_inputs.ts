import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
const PKG_LENDING = process.env.PKG_LENDING || '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';

async function main() {
  const txs = await client.queryTransactionBlocks({
    filter: { MoveFunction: { package: PKG_LENDING, module: 'lending', function: 'flash_repay_with_ctx' } },
    limit: 50,
    order: 'descending',
    options: { showInput: true },
  } as any);
  for (const t of txs.data) {
    const full = await client.getTransactionBlock({ digest: t.digest!, options: { showInput: true } as any });
    const data: any = (full as any).transaction;
    const commands: any[] = data?.data?.transaction?.commands || [];
    for (const cmd of commands) {
      if (cmd.MoveCall && cmd.MoveCall.module === 'lending' && cmd.MoveCall.function === 'flash_repay_with_ctx') {
        const args = cmd.MoveCall.arguments || [];
        // expected: [clock, &mut storage, &mut pool, receipt, balance]
        const getId = (a: any): string | null => {
          if (a?.Object?.SharedObject?.objectId) return a.Object.SharedObject.objectId;
          if (a?.Object?.ImmOrOwnedObject?.objectId) return a.Object.ImmOrOwnedObject.objectId;
          if (typeof a === 'string') return a;
          return null;
        };
        const clock = getId(args[0]);
        const storage = getId(args[1]);
        const pool = getId(args[2]);
        console.log(JSON.stringify({ digest: t.digest, storage, pool }, null, 2));
        return; // print first match
      }
    }
  }
  console.log('No recent flash_repay_with_ctx found.');
}

main().catch((e) => { console.error(e); process.exit(1); });
