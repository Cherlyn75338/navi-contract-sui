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
  return rpc('suix_queryTransactionBlocks', [{ filter, options: { showInput: true, showEffects: true, showEvents: false, showObjectChanges: true }, cursor: cursor ?? null, limit: limit ?? 50, order: 'descending' }]);
}

async function getTx(digest) {
  return rpc('sui_getTransactionBlock', [digest, { showInput: true, showEffects: true, showEvents: true, showObjectChanges: true }]);
}

function isType(t, mod, name) {
  return typeof t === 'string' && t.startsWith(PKG) && t.includes(`::${mod}::${name}`);
}

async function main() {
  // Look for recent calls to storage::init_reserve and pool::create_pool usage via manage::init maybe
  const filter = { MoveFunction: { package: PKG, module: 'storage', function: 'init_reserve' } };
  const res = await queryTxs(filter, null, 20);
  const pools = new Set();
  const storages = new Set();
  for (const tx of res.data ?? []) {
    const changes = tx.objectChanges ?? [];
    for (const ch of changes) {
      if (ch.type === 'created' || ch.type === 'mutated' || ch.type === 'published') {
        const t = ch.objectType;
        if (isType(t, 'pool', 'Pool')) pools.add(ch.objectId);
        if (isType(t, 'storage', 'Storage')) storages.add(ch.objectId);
      }
    }
  }
  console.log(JSON.stringify({ storages: Array.from(storages), pools: Array.from(pools) }, null, 2));
}

main().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});

