import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

// Utility ray math in bigint
const RAY = 10n ** 27n;
const rayMul = (a: bigint, b: bigint) => (a === 0n || b === 0n) ? 0n : (a * b + (RAY/2n)) / RAY;
const rayDiv = (a: bigint, b: bigint) => {
  if (b === 0n) throw new Error('div0');
  return (a * RAY + (b/2n)) / b;
};

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const PKG_CORE = '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';
const PKG_ORACLE = '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83';

async function queryOneByStructType(structType: string): Promise<string> {
  const res: any = await (client as any).queryObjects({
    filter: { StructType: structType },
    options: { showType: true, showOwner: true },
    limit: 10,
  });
  const d = res.data?.[0];
  if (!d) throw new Error(`No object for ${structType}`);
  return d.data.objectId;
}

async function queryPools(): Promise<{ objectId: string; type: string }[]> {
  const res: any = await (client as any).queryObjects({
    filter: { MoveModule: { package: PKG_CORE, module: 'pool' } },
    options: { showType: true },
    limit: 50,
  });
  return (res.data || [])
    .filter((x: any) => x.data?.type?.startsWith(`${PKG_CORE}::pool::Pool<`))
    .map((x: any) => ({ objectId: x.data.objectId, type: x.data.type }));
}

// Dev-inspect a single Move function call and return decoded u256s/u8
async function devInspectCall(target: string, typeArgs: string[], args: any[], sender: string) {
  const tx = new TransactionBlock();
  tx.moveCall({ target, typeArguments: typeArgs, arguments: args });
  const out = await client.devInspectTransactionBlock({ sender, transactionBlock: tx });
  if (out.error) throw new Error(`devInspect error: ${out.error}`);
  const rv = out.results?.[0]?.returnValues;
  return rv || [];
}

function asBig(rv: any): bigint {
  // rv like [bytes, typeTag]
  const hex = Buffer.from(rv[0]).toString('hex');
  return BigInt('0x' + hex);
}

function parsePoolCoinType(poolType: string): string {
  // format: 0x...::pool::Pool<COIN>
  const m = poolType.match(/Pool<(.+)>$/);
  if (!m) throw new Error(`Bad pool type: ${poolType}`);
  return m[1];
}

async function main() {
  // Discover core objects
  const storageId = await queryOneByStructType(`${PKG_CORE}::storage::Storage`);
  const oracleId = await queryOneByStructType(`${PKG_ORACLE}::oracle::PriceOracle`);
  const pools = await queryPools();
  if (!pools.length) throw new Error('No pools found');
  console.log('Storage', storageId);
  console.log('Oracle', oracleId);
  console.log('Pools', pools.slice(0, 5));

  // Sender: any address is fine for dev-inspect
  const sender = '0x0000000000000000000000000000000000000000000000000000000000000aaa';
  const clockId = '0x6';

  // Get reserves count
  const txCount = new TransactionBlock();
  txCount.moveCall({ target: `${PKG_CORE}::storage::get_reserves_count`, arguments: [txCount.object(storageId)] });
  const outCount = await client.devInspectTransactionBlock({ sender, transactionBlock: txCount });
  const reservesCount = Number(asBig(outCount.results![0].returnValues![0]));
  console.log('reservesCount', reservesCount);

  // Iterate reserves to find a match with a pool coin type
  let chosen: { reserveId: number; poolId: string; coinType: string } | null = null;
  for (let r = 0; r < reservesCount; r++) {
    // get_coin_type returns ascii string, but devInspect returns bytes; parse as hex string
    const txType = new TransactionBlock();
    txType.moveCall({ target: `${PKG_CORE}::storage::get_coin_type`, arguments: [txType.object(storageId), txType.pure.u8(r)] });
    const outType = await client.devInspectTransactionBlock({ sender, transactionBlock: txType });
    const bytes = Buffer.from(outType.results![0].returnValues![0][0]);
    const coinAscii = bytes.toString('utf8');

    for (const p of pools) {
      const poolCoin = parsePoolCoinType(p.type);
      if (poolCoin.includes(coinAscii)) {
        chosen = { reserveId: r, poolId: p.objectId, coinType: poolCoin };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) throw new Error('No reserve/pool coin match found');
  console.log('Chosen', chosen);

  // Snapshot totals and indices
  const txTS = new TransactionBlock();
  txTS.moveCall({ target: `${PKG_CORE}::storage::get_total_supply`, arguments: [txTS.object(storageId), txTS.pure.u8(chosen.reserveId)] });
  const outTS = await client.devInspectTransactionBlock({ sender, transactionBlock: txTS });
  const v0 = asBig(outTS.results![0].returnValues![0]);
  const v1 = asBig(outTS.results![0].returnValues![1]);

  const txIX = new TransactionBlock();
  txIX.moveCall({ target: `${PKG_CORE}::storage::get_index`, arguments: [txIX.object(storageId), txIX.pure.u8(chosen.reserveId)] });
  const outIX = await client.devInspectTransactionBlock({ sender, transactionBlock: txIX });
  const v2 = asBig(outIX.results![0].returnValues![0]);
  const v3 = asBig(outIX.results![0].returnValues![1]);

  console.log('Totals', { v0: v0.toString(), v1: v1.toString() });
  console.log('Indices', { v2: v2.toString(), v3: v3.toString() });

  const v4 = rayMul(v0, v2);
  const v5 = rayMul(v1, v3);
  const room = v4 > v5 ? v4 - v5 : 0n;
  if (room <= 0n) throw new Error('No room');

  // Borrow POC: arg2_min = ceil(room / v3 in ray)
  const arg2Min = rayDiv(room, v3);
  // Convert normalized arg2 to amount u64 using pool::unnormal_amount
  const txUnnorm = new TransactionBlock();
  txUnnorm.moveCall({ target: `${PKG_CORE}::pool::unnormal_amount<${chosen.coinType}>`, arguments: [txUnnorm.object(chosen.poolId), txUnnorm.pure.u64(Number(arg2Min))] });
  const outUn = await client.devInspectTransactionBlock({ sender, transactionBlock: txUnnorm });
  const amountU64 = Number(asBig(outUn.results![0].returnValues![0]));
  console.log('arg2Min(normalized)=', arg2Min.toString(), ' amountU64=', amountU64);

  // Now dev-inspect borrow entry
  const txBorrow = new TransactionBlock();
  txBorrow.moveCall({ target: `${PKG_CORE}::lending::borrow<${chosen.coinType}>`, arguments: [
    txBorrow.object(clockId),
    txBorrow.object(oracleId),
    txBorrow.object(storageId),
    txBorrow.object(chosen.poolId),
    txBorrow.pure.u8(chosen.reserveId),
    txBorrow.pure.u64(amountU64),
  ]});
  const outBorrow = await client.devInspectTransactionBlock({ sender, transactionBlock: txBorrow });
  console.log('Borrow dev-inspect:', outBorrow.effects?.status, outBorrow.error || null);
}

main().catch((e) => { console.error(e); process.exit(1); });

