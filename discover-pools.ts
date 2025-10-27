import { SuiClient, getFullnodeUrl } from '@mysten/sui.js';
import type { PaginatedEvents } from '@mysten/sui.js';

// Observed on-chain package address from normalized modules
const POOL_PACKAGE = '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca';
const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function fetchPoolIdsFromEvents(limit = 1000) {
  const poolIds = new Set<string>();
  let cursor: string | null = null;
  let fetched = 0;
  const filter = { MoveModule: { package: POOL_PACKAGE, module: 'pool' } } as any;
  while (fetched < limit) {
    const res: PaginatedEvents = await client.queryEvents({ filter, cursor, limit: 50 });
    for (const ev of res.data) {
      if (typeof ev.type !== 'string') continue;
      if (ev.type.endsWith('::pool::PoolWithdrawReserve')) {
        const fields = ev.parsedJson as any;
        const pid = fields?.poolId as string | undefined;
        if (pid) poolIds.add(pid);
      }
    }
    fetched += res.data.length;
    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return Array.from(poolIds);
}

async function getPoolTypeTag(objectId: string): Promise<string | null> {
  try {
    const obj = await client.getObject({ id: objectId, options: { showType: true } });
    const type = (obj.data as any)?.type as string | undefined;
    return type ?? null;
  } catch {
    return null;
  }
}

function extractCoinTypeFromPoolType(poolType: string): string | null {
  // Expect format: `${POOL_PACKAGE}::pool::Pool<COIN_TYPE>`
  const m = poolType.match(/::pool::Pool<(.+)>$/);
  return m ? m[1] : null;
}

async function main() {
  const poolIds = await fetchPoolIdsFromEvents(2000);
  const groups = new Map<string, Set<string>>();
  for (const pid of poolIds) {
    const t = await getPoolTypeTag(pid);
    if (!t) continue;
    const coin = extractCoinTypeFromPoolType(t);
    if (!coin) continue;
    if (!groups.has(coin)) groups.set(coin, new Set());
    groups.get(coin)!.add(pid);
  }
  const report: Record<string, string[]> = {};
  for (const [coin, set] of groups.entries()) report[coin] = Array.from(set);
  console.log(JSON.stringify({ poolPackage: POOL_PACKAGE, coins: report }, null, 2));
  const multiplicity = Object.entries(report).filter(([, ids]) => ids.length > 1);
  console.log('Multiplicity findings:', JSON.stringify(multiplicity, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

