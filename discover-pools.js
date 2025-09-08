const RPC = 'https://fullnode.mainnet.sui.io:443';
const POOL_PACKAGE = '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca';

async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.result;
}

async function queryEvents(filter, cursor, limit) {
  // suix_queryEvents expects params: [ EventFilter, cursor, limit ]
  return rpc('suix_queryEvents', [filter, cursor ?? null, limit ?? 50]);
}

async function getObject(id) {
  return rpc('sui_getObject', [id, { showType: true }]);
}

function extractCoinTypeFromPoolType(t) {
  const m = typeof t === 'string' && t.match(/::pool::Pool<(.+)>$/);
  return m ? m[1] : null;
}

async function discover(limit = 2000) {
  const poolIds = new Set();
  let cursor = null;
  let fetched = 0;
  // Filter events emitted by the pool and storage modules in this package
  const poolFilter = { MoveEventModule: { package: POOL_PACKAGE, module: 'pool' } };
  const storageFilter = { MoveEventModule: { package: POOL_PACKAGE, module: 'storage' } };
  while (fetched < limit) {
    const res1 = await queryEvents(poolFilter, cursor, 50);
    const res2 = await queryEvents(storageFilter, cursor, 50);
    const data = [...(res1.data || []), ...(res2.data || [])];
    for (const ev of data) {
      if (typeof ev.type !== 'string') continue;
      if (ev.type.endsWith('::pool::PoolWithdrawReserve') || ev.type.endsWith('::storage::WithdrawTreasuryEvent')) {
        const pid = ev.parsedJson?.poolId;
        if (pid) poolIds.add(pid);
      }
    }
    fetched += data.length;
    cursor = res1.nextCursor || res2.nextCursor || null;
    if (!(res1.hasNextPage || res2.hasNextPage)) break;
  }

  const groups = new Map();
  for (const id of poolIds) {
    const obj = await getObject(id);
    const typ = obj?.data?.type;
    const coin = extractCoinTypeFromPoolType(typ);
    if (!coin) continue;
    if (!groups.has(coin)) groups.set(coin, new Set());
    groups.get(coin).add(id);
  }

  const out = {};
  for (const [coin, ids] of groups.entries()) out[coin] = Array.from(ids);
  const multiplicity = Object.entries(out).filter(([, ids]) => ids.length > 1);
  return { poolPackage: POOL_PACKAGE, coins: out, multiplicity };
}

(async () => {
  try {
    const res = await discover(2000);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('ERR', e);
    process.exit(1);
  }
})();

