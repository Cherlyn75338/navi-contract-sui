const RPC = 'https://fullnode.mainnet.sui.io:443';
const PKG = '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca';

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

async function queryTxs(filter, cursor, limit) {
  return rpc('suix_queryTransactionBlocks', [{ filter, options: { showInput: false, showEffects: true, showEvents: false, showObjectChanges: true }, cursor: cursor ?? null, limit: limit ?? 50, order: 'descending' }]);
}

function extractCoinTypeFromPoolType(t) {
  const m = typeof t === 'string' && t.match(/::pool::Pool<(.+)>$/);
  return m ? m[1] : null;
}

(async () => {
  try {
    // Fallback: filter by TransactionKindIn with module function names typical for pool interactions
    const functionKinds = [
      { MoveFunction: { package: PKG, module: 'pool', function: 'create_pool' } },
      { MoveFunction: { package: PKG, module: 'pool', function: 'deposit' } },
      { MoveFunction: { package: PKG, module: 'pool', function: 'withdraw' } },
      { MoveFunction: { package: PKG, module: 'lending', function: 'deposit' } },
      { MoveFunction: { package: PKG, module: 'lending', function: 'withdraw' } }
    ];
    let cursor = null;
    const pools = new Map(); // id -> type
    let scanned = 0;
    while (scanned < 2000) {
      const res = await queryTxs({ TransactionKindIn: functionKinds }, cursor, 50);
      for (const tx of res.data ?? []) {
        for (const ch of tx.objectChanges ?? []) {
          if (ch.type === 'created' || ch.type === 'mutated') {
            const t = ch.objectType;
            if (typeof t === 'string' && t.includes('::pool::Pool<')) {
              pools.set(ch.objectId, t);
            }
          }
        }
      }
      scanned += (res.data ?? []).length;
      if (!res.hasNextPage || !res.nextCursor) break;
      cursor = res.nextCursor;
    }
    const groups = new Map();
    for (const [id, type] of pools.entries()) {
      const coin = extractCoinTypeFromPoolType(type);
      if (!coin) continue;
      if (!groups.has(coin)) groups.set(coin, []);
      groups.get(coin).push(id);
    }
    const out = Object.fromEntries(Array.from(groups.entries()).map(([k, v]) => [k, v]));
    const multiplicity = Object.entries(out).filter(([, ids]) => ids.length > 1);
    console.log(JSON.stringify({ pkg: PKG, totalPools: pools.size, coins: out, multiplicity }, null, 2));
  } catch (e) {
    console.error('ERR', e);
    process.exit(1);
  }
})();

