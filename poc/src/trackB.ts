import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

type AnyRecord = Record<string, any>;

const AGG_PACKAGES = [
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83',
];

const ENV = {
  SIGNER: process.env.POC_SIGNER || '',
  COIN_ID: process.env.POC_COIN_ID || '',
  ORACLE_ID: process.env.POC_ORACLE_ID || '',
  STORAGE_ID: process.env.POC_STORAGE_ID || '',
  POOL_A_ID: process.env.POC_POOL_A || '',
  POOL_B_ID: process.env.POC_POOL_B || '',
  ASSET_ID: process.env.POC_ASSET_ID || '',
  COIN_TYPE: process.env.POC_COIN_TYPE || '',
  RUN_DEV_INSPECT: process.env.POC_RUN_DEV_INSPECT === '1' || false,
  LENDING_MODULE: process.env.POC_LENDING_MODULE || 'lending',
  ENTRY_DEPOSIT: process.env.POC_ENTRY_DEPOSIT || 'entry_deposit',
  ENTRY_WITHDRAW: process.env.POC_ENTRY_WITHDRAW || 'entry_withdraw',
};

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function getModule(pkg: string, module: string): Promise<AnyRecord | null> {
  try {
    const mod = await client.getNormalizedMoveModule({ package: pkg, module });
    return mod as AnyRecord;
  } catch (e) {
    return null;
  }
}

function collectAddr(mod: AnyRecord, moduleName: string, structName: string): string | null {
  // Scan function parameters to find the address of a given struct
  const fns: AnyRecord = mod.functions ?? mod.exposedFunctions ?? {};
  for (const [, fdef] of Object.entries(fns)) {
    const params: any[] = (fdef as AnyRecord).parameters ?? [];
    for (const p of params) {
      const addr = findStructAddrInType(p, moduleName, structName);
      if (addr) return addr;
    }
  }
  return null;
}

function findStructAddrInType(ty: any, moduleName: string, structName: string): string | null {
  if (!ty) return null;
  if (ty.Struct && ty.Struct.module === moduleName && ty.Struct.name === structName) {
    return ty.Struct.address;
  }
  if (ty.Reference) return findStructAddrInType(ty.Reference, moduleName, structName);
  if (ty.MutableReference) return findStructAddrInType(ty.MutableReference, moduleName, structName);
  if (ty.Vector) return findStructAddrInType(ty.Vector, moduleName, structName);
  if (ty.Struct && Array.isArray(ty.Struct.typeArguments)) {
    for (const t of ty.Struct.typeArguments) {
      const a = findStructAddrInType(t, moduleName, structName);
      if (a) return a;
    }
  }
  return null;
}

async function listPackageObjects(pkg: string) {
  const objs: any[] = [];
  let cursor: string | null = null;
  do {
    const resp: any = await (client as any).call({
      method: 'suix_queryObjects',
      params: [
        { filter: { Package: pkg }, options: { showType: true, showOwner: true, showContent: true } },
        cursor,
        100,
      ],
    });
    objs.push(...(resp.data || []));
    cursor = resp.hasNextPage ? resp.nextCursor : null;
  } while (cursor);
  return objs;
}

function extractPoolTypeArg(typeStr: string): string | null {
  // example: 0xd899..::pool::Pool<0x2::sui::SUI>
  const m = typeStr.match(/::pool::Pool<(.+)>/);
  return m ? m[1] : null;
}

async function main() {
  console.log('Track B: object discovery and optional devInspect');

  // Prefer 0x66aa.. as aggregator, fall back to next
  let aggPkg = '';
  let lendMod: AnyRecord | null = null;
  for (const p of AGG_PACKAGES) {
    const m = await getModule(p, ENV.LENDING_MODULE);
    if (m) {
      aggPkg = p;
      lendMod = m;
      break;
    }
  }
  if (!lendMod) {
    console.log('No lending module found among given packages. Aborting.');
    return;
  }
  console.log('Using lending module at', `${aggPkg}::${ENV.LENDING_MODULE}`);

  const storagePkg = collectAddr(lendMod, 'storage', 'Storage');
  const poolPkg = collectAddr(lendMod, 'pool', 'Pool');
  const oraclePkg = collectAddr(lendMod, 'oracle', 'PriceOracle');
  const incentivePkg = collectAddr(lendMod, 'incentive', 'Incentive');
  const incentiveV2Pkg = collectAddr(lendMod, 'incentive_v2', 'Incentive');

  console.log('Resolved module addresses:');
  console.log('  storage pkg:', storagePkg);
  console.log('  pool pkg   :', poolPkg);
  console.log('  oracle pkg :', oraclePkg);
  console.log('  incentive  :', incentivePkg);
  console.log('  incentiveV2:', incentiveV2Pkg);

  if (!poolPkg || !storagePkg) {
    console.log('Missing pool or storage package address. Aborting inventory.');
    return;
  }

  // Inventory objects in pool/storage packages
  let poolObjs: any[] = [];
  let storageObjs: any[] = [];
  let incentiveObjs: any[] = [];
  try { poolObjs = await listPackageObjects(poolPkg); } catch (e) { console.log('Pool object enumeration not available:', (e as Error).message); }
  try { storageObjs = await listPackageObjects(storagePkg); } catch (e) { console.log('Storage object enumeration not available:', (e as Error).message); }
  if (incentivePkg) {
    try { incentiveObjs = await listPackageObjects(incentivePkg); } catch (e) { console.log('Incentive object enumeration not available:', (e as Error).message); }
  }

  const pools = poolObjs.filter((o) => typeof o.data?.type === 'string' && o.data.type.includes('::pool::Pool<'));
  const storages = storageObjs.filter((o) => typeof o.data?.type === 'string' && o.data.type.endsWith('::storage::Storage'));
  const incentives = (incentiveObjs || []).filter((o) => typeof o.data?.type === 'string' && o.data.type.endsWith('::incentive::Incentive'));
  const incentivesV2 = (incentiveObjs || []).filter((o) => typeof o.data?.type === 'string' && o.data.type.endsWith('::incentive_v2::Incentive'));

  console.log(`Pools found: ${pools.length}`);
  console.log(`Storages found: ${storages.length}`);
  console.log(`Incentive candidates: ${incentives.length}, IncentiveV2 candidates: ${incentivesV2.length}`);

  // Group pools by type arg T
  const groups = new Map<string, string[]>();
  for (const p of pools) {
    const t = extractPoolTypeArg(p.data.type);
    if (!t) continue;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(p.data.objectId);
  }

  if (groups.size > 0) {
    for (const [t, ids] of groups.entries()) {
      console.log(`Pool<T=${t}> count=${ids.length}`);
    }
  } else {
    console.log('No pools enumerated (RPC filtering by package may be unavailable on this node).');
  }

  // Optional devInspect
  if (!ENV.RUN_DEV_INSPECT) {
    console.log('POC_RUN_DEV_INSPECT not set; skipping devInspect.');
    return;
  }

  const required = [ENV.SIGNER, ENV.COIN_ID, ENV.STORAGE_ID, ENV.POOL_A_ID, ENV.POOL_B_ID, ENV.ASSET_ID, ENV.COIN_TYPE];
  if (required.some((x) => !x)) {
    console.log('Missing one or more required env vars for devInspect:');
    console.log('  POC_SIGNER, POC_COIN_ID, POC_STORAGE_ID, POC_POOL_A, POC_POOL_B, POC_ASSET_ID, POC_COIN_TYPE');
    console.log('Optionally POC_ORACLE_ID, POC_INC_ID, POC_INCV2_ID');
    return;
  }

  const tx = new TransactionBlock();
  // entry_deposit<T>(clock, storage, pool, asset, coin<T>, amount, incentive, incentive_v2)
  tx.moveCall({
    target: `${aggPkg}::${ENV.LENDING_MODULE}::${ENV.ENTRY_DEPOSIT}<${ENV.COIN_TYPE}>`,
    arguments: [
      tx.object('0x6'),
      tx.object(ENV.STORAGE_ID),
      tx.object(ENV.POOL_A_ID),
      tx.pure(Number(ENV.ASSET_ID)),
      tx.object(ENV.COIN_ID),
      tx.pure(1), // minimal amount
      ...(incentives.length > 0 ? [tx.object(incentives[0].data.objectId)] : []),
      ...(incentivesV2.length > 0 ? [tx.object(incentivesV2[0].data.objectId)] : []),
    ],
  });

  // entry_withdraw<T>(clock, oracle, storage, pool, asset, amount, to, incentive, incentive_v2)
  const withdrawArgs: any[] = [
    tx.object('0x6'),
  ];
  if (ENV.ORACLE_ID) withdrawArgs.push(tx.object(ENV.ORACLE_ID));
  else if (oraclePkg) {
    console.log('No POC_ORACLE_ID set; withdraw may fail without an oracle object.');
    withdrawArgs.push(tx.object('0x0')); // placeholder will fail
  }
  withdrawArgs.push(
    tx.object(ENV.STORAGE_ID),
    tx.object(ENV.POOL_B_ID),
    tx.pure(Number(ENV.ASSET_ID)),
    tx.pure(1),
    tx.pure(ENV.SIGNER),
  );
  if (incentives.length > 0) withdrawArgs.push(tx.object(incentives[0].data.objectId));
  if (incentivesV2.length > 0) withdrawArgs.push(tx.object(incentivesV2[0].data.objectId));

  tx.moveCall({
    target: `${aggPkg}::${ENV.LENDING_MODULE}::${ENV.ENTRY_WITHDRAW}<${ENV.COIN_TYPE}>`,
    arguments: withdrawArgs,
  });

  const sim = await client.devInspectTransactionBlock({ transactionBlock: tx, sender: ENV.SIGNER });
  console.log('devInspect status:', sim.effects?.status);
  if ((sim as AnyRecord).error) console.log('error:', (sim as AnyRecord).error);
  console.log('events (types only):', (sim.events || []).map((e) => (e as AnyRecord).type));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

