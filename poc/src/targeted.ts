import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { FULLNODE } from './config.js';

const client = new SuiClient({ url: FULLNODE || getFullnodeUrl('mainnet') });

const TYPES = [
  '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::storage::Storage',
  '0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f::oracle::PriceOracle',
  '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::pool::Pool',
  '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::incentive_v3::Incentive',
  '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::incentive_v2::Incentive'
];

async function main() {
  for (const structType of TYPES) {
    try {
      const res = await client.queryEvents({ query: { MoveEventType: structType }, limit: 1 });
      // Fallback to query transaction blocks referencing the module (heuristic)
      const res2 = await client.queryTransactionBlocks({ filter: { MoveModule: { package: structType.split('::')[0], module: structType.split('::')[1] } }, options: { showObjectChanges: true }, limit: 10, order: 'descending' });
      console.log(`\nType ${structType}: events ${res.data?.length || 0}, txs ${res2.data?.length || 0}`);
      for (const tx of res2.data || []) {
        for (const oc of tx.objectChanges || []) {
          if (oc.type === 'created') console.log(`- created ${oc.objectId} ${oc.objectType}`);
        }
      }
    } catch (e) {
      console.log(`Error querying ${structType}: ${String((e as Error).message || e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

