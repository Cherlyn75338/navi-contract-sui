import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
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
    INCENTIVE_ID: process.env.POC_INCENTIVE_ID || '',
    INCV2_ID: process.env.POC_INCV2_ID || '',
};
const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
async function getModule(pkg, module) {
    try {
        const mod = await client.getNormalizedMoveModule({ package: pkg, module });
        return mod;
    }
    catch (e) {
        return null;
    }
}
function collectAddr(mod, moduleName, structName) {
    // Scan function parameters to find the address of a given struct
    const fns = mod.functions ?? mod.exposedFunctions ?? {};
    for (const [, fdef] of Object.entries(fns)) {
        const params = fdef.parameters ?? [];
        for (const p of params) {
            const addr = findStructAddrInType(p, moduleName, structName);
            if (addr)
                return addr;
        }
    }
    return null;
}
function findStructAddrInType(ty, moduleName, structName) {
    if (!ty)
        return null;
    if (ty.Struct && ty.Struct.module === moduleName && ty.Struct.name === structName) {
        return ty.Struct.address;
    }
    if (ty.Reference)
        return findStructAddrInType(ty.Reference, moduleName, structName);
    if (ty.MutableReference)
        return findStructAddrInType(ty.MutableReference, moduleName, structName);
    if (ty.Vector)
        return findStructAddrInType(ty.Vector, moduleName, structName);
    if (ty.Struct && Array.isArray(ty.Struct.typeArguments)) {
        for (const t of ty.Struct.typeArguments) {
            const a = findStructAddrInType(t, moduleName, structName);
            if (a)
                return a;
        }
    }
    return null;
}
async function listPackageObjects(pkg) {
    const objs = [];
    let cursor = null;
    do {
        const resp = await client.call('suix_queryObjects', [
            { filter: { Package: pkg }, options: { showType: true, showOwner: true, showContent: true } },
            cursor,
            100,
        ]);
        objs.push(...(resp.data || []));
        cursor = resp.hasNextPage ? resp.nextCursor : null;
    } while (cursor);
    return objs;
}
function extractPoolTypeArg(typeStr) {
    // example: 0xd899..::pool::Pool<0x2::sui::SUI>
    const m = typeStr.match(/::pool::Pool<(.+)>/);
    return m ? m[1] : null;
}
async function main() {
    console.log('Track B: object discovery and optional devInspect');
    // Prefer 0x66aa.. as aggregator, fall back to next
    let aggPkg = '';
    let lendMod = null;
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
    // Attempt inventory by scanning recent tx blocks globally (objectChanges)
    const pools = [];
    const storages = [];
    // Try event-based discovery for specific event types that include poolId
    try {
        const eventTypes = [
            `${poolPkg}::pool::PoolWithdrawReserve`,
            `${poolPkg}::pool::PoolDeposit`,
            `${poolPkg}::pool::PoolWithdraw`,
        ];
        const foundIds = new Set();
        for (const et of eventTypes) {
            let cursor = null;
            const maxPages = 10;
            for (let i = 0; i < maxPages; i++) {
                const resp = await client.queryEvents({
                    query: { MoveEventType: et },
                    cursor,
                    limit: 50,
                    order: 'descending',
                });
                for (const ev of resp.data || []) {
                    const pj = ev.parsedJson;
                    if (!pj)
                        continue;
                    const pid = (pj.poolId || pj.pool_id || pj.poolID);
                    if (pid && pid.startsWith('0x'))
                        foundIds.add(pid);
                }
                if (!resp.hasNextPage || !resp.nextCursor)
                    break;
                cursor = resp.nextCursor;
            }
        }
        for (const id of foundIds) {
            try {
                const obj = await client.getObject({ id, options: { showType: true } });
                const ty = obj.data?.type || '';
                if (typeof ty === 'string' && ty.includes('::pool::Pool<'))
                    pools.push({ objectId: id, type: ty });
            }
            catch { }
        }
    }
    catch (e) {
        console.log('Event-based discovery failed:', e.message);
    }
    // First try event-based discovery for pool ids with explicit poolId field
    // Try scan by querying objects directly for StructType filters as a fallback
    try {
        const respPools = await client.call('suix_queryObjects', [
            { filter: { StructType: `${poolPkg}::pool::Pool` }, options: { showType: true } },
            null,
            1000,
        ]);
        for (const o of (respPools.data || [])) {
            if (o.data?.type && typeof o.data.type === 'string' && o.data.type.includes('::pool::Pool<')) {
                pools.push({ objectId: o.data.objectId, type: o.data.type });
            }
        }
    }
    catch (e) {
        console.log('StructType pool query failed:', e.message);
    }
    try {
        let cursor = null;
        const maxPages = 30;
        for (let i = 0; i < maxPages; i++) {
            const resp = await client.queryTransactionBlocks({
                options: { showObjectChanges: true },
                cursor,
                limit: 100,
                order: 'descending',
            });
            for (const tx of (resp.data || [])) {
                const changes = tx.objectChanges || [];
                for (const ch of changes) {
                    if (ch.type === 'created' && typeof ch.objectType === 'string') {
                        if (poolPkg && ch.objectType.startsWith(`${poolPkg}::pool::Pool<`)) {
                            pools.push({ objectId: ch.objectId, type: ch.objectType });
                        }
                        if (storagePkg && ch.objectType === `${storagePkg}::storage::Storage`) {
                            storages.push({ objectId: ch.objectId, type: ch.objectType });
                        }
                    }
                }
            }
            if (!resp.hasNextPage || !resp.nextCursor)
                break;
            cursor = resp.nextCursor;
            if (pools.length >= 50 && storages.length >= 5)
                break;
        }
    }
    catch (e) {
        console.log('Recent tx scan failed:', e.message);
    }
    console.log(`Pools found (by tx scan): ${pools.length}`);
    console.log(`Storages found (by tx scan): ${storages.length}`);
    // Group pools by type arg T
    const groups = new Map();
    for (const p of pools) {
        const t = extractPoolTypeArg(p.type);
        if (!t)
            continue;
        if (!groups.has(t))
            groups.set(t, []);
        groups.get(t).push(p.objectId);
    }
    if (groups.size > 0) {
        for (const [t, ids] of groups.entries()) {
            console.log(`Pool<T=${t}> count=${ids.length} ids=${ids.join(',')}`);
        }
    }
    else {
        console.log('No pools grouped by type (recent tx scan might be insufficient).');
    }
    // Additional discovery via MoveFunction filter on aggregator module
    try {
        const foundPools = new Set();
        const foundStorages = new Set();
        const foundInc = new Set();
        const foundIncV2 = new Set();
        const fnNames = [
            ENV.ENTRY_DEPOSIT,
            ENV.ENTRY_WITHDRAW,
            'deposit',
            'withdraw',
            'borrow',
            'repay',
            'entry_borrow',
            'entry_repay',
            'entry_deposit_on_behalf_of_user',
            'withdraw_with_account_cap',
            'deposit_with_account_cap',
        ];
        for (const fn of fnNames) {
            try {
                const resp = await client.queryTransactionBlocks({
                    filter: { MoveFunction: { package: aggPkg, module: ENV.LENDING_MODULE, function: fn } },
                    options: { showObjectChanges: true },
                    limit: 100,
                    order: 'descending',
                });
                for (const tx of resp.data || []) {
                    const changes = tx.objectChanges || [];
                    for (const ch of changes) {
                        if ((ch.type === 'created' || ch.type === 'mutated') && typeof ch.objectType === 'string') {
                            const ty = ch.objectType;
                            if (poolPkg && ty.startsWith(`${poolPkg}::pool::Pool<`))
                                foundPools.add(ch.objectId);
                            if (storagePkg && ty === `${storagePkg}::storage::Storage`)
                                foundStorages.add(ch.objectId);
                            if (incentivePkg && ty === `${incentivePkg}::incentive::Incentive`)
                                foundInc.add(ch.objectId);
                            if (incentivePkg && ty === `${incentivePkg}::incentive_v2::Incentive`)
                                foundIncV2.add(ch.objectId);
                        }
                    }
                }
            }
            catch { }
        }
        if (foundPools.size > 0 || foundStorages.size > 0 || foundInc.size > 0 || foundIncV2.size > 0) {
            console.log('Discovered via MoveFunction tx filter:');
            if (foundPools.size > 0)
                console.log('  Pools:', Array.from(foundPools).join(','));
            if (foundStorages.size > 0)
                console.log('  Storages:', Array.from(foundStorages).join(','));
            if (foundInc.size > 0)
                console.log('  Incentive:', Array.from(foundInc).join(','));
            if (foundIncV2.size > 0)
                console.log('  IncentiveV2:', Array.from(foundIncV2).join(','));
        }
    }
    catch (e) {
        console.log('MoveFunction filter discovery failed:', e.message);
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
        console.log('Optionally POC_ORACLE_ID, POC_INCENTIVE_ID, POC_INCV2_ID');
        return;
    }
    const tx = new TransactionBlock();
    // Build args dynamically from ABI to match exact arity and types
    const mod = await client.getNormalizedMoveModule({ package: aggPkg, module: ENV.LENDING_MODULE });
    const fns = mod.functions ?? mod.exposedFunctions ?? {};
    const dep = fns[ENV.ENTRY_DEPOSIT];
    const wdr = fns[ENV.ENTRY_WITHDRAW];
    if (!dep || !wdr) {
        console.log('Selected functions not found in module.');
        return;
    }
    const buildArg = (p, ctx) => {
        const unwrap = (x) => (x.MutableReference || x.Reference || x);
        const t = unwrap(p);
        if (t.Struct && t.Struct.address === '0x2' && t.Struct.module === 'clock' && t.Struct.name === 'Clock')
            return tx.object('0x6');
        if (t.Struct && t.Struct.module === 'storage' && t.Struct.name === 'Storage')
            return tx.object(ENV.STORAGE_ID);
        if (t.Struct && t.Struct.module === 'pool' && t.Struct.name === 'Pool')
            return tx.object(ctx === 'deposit' ? ENV.POOL_A_ID : ENV.POOL_B_ID);
        if (t.Struct && t.Struct.module === 'oracle' && t.Struct.name === 'PriceOracle')
            return tx.object(ENV.ORACLE_ID);
        if (t.Struct && t.Struct.module === 'incentive' && t.Struct.name === 'Incentive')
            return tx.object(ENV.INCENTIVE_ID);
        if (t.Struct && t.Struct.module === 'incentive_v2' && t.Struct.name === 'Incentive')
            return tx.object(ENV.INCV2_ID);
        if (t.Struct && t.Struct.address === '0x2' && t.Struct.module === 'coin' && t.Struct.name === 'Coin')
            return tx.object(ENV.COIN_ID);
        if (t === 'U8')
            return tx.pure(Number(ENV.ASSET_ID));
        if (t === 'U64')
            return tx.pure(1);
        if (t === 'Address')
            return tx.pure(ENV.SIGNER);
        if (t.Struct && t.Struct.address === '0x2' && t.Struct.module === 'tx_context' && t.Struct.name === 'TxContext')
            return undefined; // implicit
        return undefined;
    };
    const depArgs = dep.parameters.map((p) => buildArg(p, 'deposit')).filter((x) => x !== undefined);
    const wdrArgs = wdr.parameters.map((p) => buildArg(p, 'withdraw')).filter((x) => x !== undefined);
    // Validate presence of required external object IDs based on ABI
    const needsOracle = wdr.parameters.some((p) => (p.MutableReference || p.Reference || p)?.Struct?.module === 'oracle');
    if (needsOracle && !ENV.ORACLE_ID) {
        console.log('Withdraw requires oracle; set POC_ORACLE_ID.');
        return;
    }
    const needsInc = dep.parameters.some((p) => (p.MutableReference || p.Reference || p)?.Struct?.module === 'incentive');
    if (needsInc && !ENV.INCENTIVE_ID) {
        console.log('Deposit requires incentive; set POC_INCENTIVE_ID.');
        return;
    }
    const needsIncV2 = dep.parameters.some((p) => (p.MutableReference || p.Reference || p)?.Struct?.module === 'incentive_v2');
    if (needsIncV2 && !ENV.INCV2_ID) {
        console.log('Deposit requires incentive_v2; set POC_INCV2_ID.');
        return;
    }
    tx.moveCall({
        target: `${aggPkg}::${ENV.LENDING_MODULE}::${ENV.ENTRY_DEPOSIT}<${ENV.COIN_TYPE}>`,
        arguments: depArgs,
    });
    tx.moveCall({
        target: `${aggPkg}::${ENV.LENDING_MODULE}::${ENV.ENTRY_WITHDRAW}<${ENV.COIN_TYPE}>`,
        arguments: wdrArgs,
    });
    const sim = await client.devInspectTransactionBlock({ transactionBlock: tx, sender: ENV.SIGNER });
    console.log('devInspect status:', sim.effects?.status);
    if (sim.error)
        console.log('error:', sim.error);
    console.log('events (types only):', (sim.events || []).map((e) => e.type));
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
