import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
const digests = (process.env.DIGESTS || '').split(',').map((s) => s.trim()).filter(Boolean);

async function main() {
  if (digests.length === 0) {
    console.error('Set DIGESTS env var to comma-separated tx digests');
    process.exit(1);
  }
  for (const digest of digests) {
    const tx = await client.getTransactionBlock({ digest, options: { showInput: true } as any });
    const data: any = (tx as any).transaction;
    const commands: any[] = data?.data?.transaction?.commands || [];
    console.log(`TX ${digest}`);
    for (const cmd of commands) {
      if (cmd.MoveCall) {
        const mc = cmd.MoveCall;
        const target = `${mc.package}::${mc.module}::${mc.function}`;
        const targs = mc.typeArguments || [];
        if (mc.module === 'lending' && mc.function === 'flash_loan_with_ctx') {
          const args = mc.arguments;
          let configId: string | null = null;
          let poolId: string | null = null;
          if (Array.isArray(args) && args.length >= 2) {
            const a0 = args[0];
            const a1 = args[1];
            const getId = (a: any): string | null => {
              if (a?.Object?.ImmOrOwnedObject?.objectId) return a.Object.ImmOrOwnedObject.objectId;
              if (a?.Object?.SharedObject?.objectId) return a.Object.SharedObject.objectId;
              if (typeof a === 'string') return a;
              return null;
            };
            configId = getId(a0);
            poolId = getId(a1);
          }
          console.log(JSON.stringify({ target, typeArguments: targs, configId, poolId }, null, 2));
        }
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
