import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const ids = (process.env.CANDIDATES || '').split(',').map((s) => s.trim()).filter(Boolean);

async function main() {
  if (ids.length === 0) {
    console.error('Set CANDIDATES env var to comma-separated object IDs');
    process.exit(1);
  }
  for (const id of ids) {
    try {
      const obj = await client.getObject({ id, options: { showType: true, showOwner: true } });
      const type = (obj.data as any)?.type;
      const owner = (obj.data as any)?.owner;
      console.log(JSON.stringify({ id, type, owner }, null, 2));
    } catch (e) {
      console.error('Error for', id, e);
    }
  }
}

main();
