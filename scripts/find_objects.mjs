import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const PACKAGES = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
];

async function listByPackage(pkg, limit = 1000) {
  let cursor = null;
  const out = [];
  while (out.length < limit) {
    const res = await client.queryTransactions({
      filter: { FromAddress: pkg },
      cursor,
      limit: 50,
      order: 'descending',
    });
    // This endpoint won't directly list objects by package; fallback to event path
    break;
  }
  return out;
}

function byType(objs, typePrefix) {
  return objs.filter(o => o.data?.type && String(o.data.type).startsWith(typePrefix));
}

async function main() {
  for (const pkg of PACKAGES) {
    console.log('PACKAGE', pkg);
    console.log(' queryObjects not available in this SDK; use events.mjs outputs or explorer to gather object IDs.');
  }
}

main();

