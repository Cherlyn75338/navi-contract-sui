import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
const PKG = process.env.PKG || '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca';

async function query(type: string, limit: number) {
  try {
    const res: any = await client.queryEvents({ query: { MoveEventType: type }, limit });
    return (res.data || []) as any[];
  } catch (e) {
    return [];
  }
}

async function main() {
  const typeConfigCreated = `${PKG}::flash_loan::ConfigCreated`;
  const typeAssetConfigCreated = `${PKG}::flash_loan::AssetConfigCreated`;

  let ids: string[] = [];

  for (const lim of [100, 500, 1000]) {
    const evs = await query(typeConfigCreated, lim);
    for (const e of evs) {
      const id = e?.parsedJson?.id;
      if (id && !ids.includes(id)) ids.push(id);
    }
  }

  if (ids.length === 0) {
    for (const lim of [100, 500, 1000]) {
      const evs = await query(typeAssetConfigCreated, lim);
      for (const e of evs) {
        const id = e?.parsedJson?.config_id;
        if (id && !ids.includes(id)) ids.push(id);
      }
    }
  }

  console.log(JSON.stringify({ pkg: PKG, found: ids }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
