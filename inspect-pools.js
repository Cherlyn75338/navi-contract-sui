const RPC = 'https://fullnode.mainnet.sui.io:443';

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

async function getObject(id) {
  return rpc('sui_getObject', [id, { showType: true }]);
}

function extractCoinTypeFromPoolType(t) {
  const m = typeof t === 'string' && t.match(/::pool::Pool<(.+)>$/);
  return m ? m[1] : null;
}

(async () => {
  try {
    const ids = process.argv.slice(2);
    const groups = new Map();
    for (const id of ids) {
      const obj = await getObject(id);
      const type = obj?.data?.type;
      const coin = extractCoinTypeFromPoolType(type);
      if (!coin) continue;
      if (!groups.has(coin)) groups.set(coin, []);
      groups.get(coin).push({ id, type });
    }
    console.log(JSON.stringify(Object.fromEntries(groups), null, 2));
  } catch (e) {
    console.error('ERR', e);
    process.exit(1);
  }
})();

