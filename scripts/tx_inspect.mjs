import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const DIGESTS = [
  'DSnsvggeiHk1AgjFE3B1758MaURrm9p6cM2Fes3AJQmV',
  '3ZawDtQRAnxx6A9hjUw7SRi8Dv62xrAuz6Hc2uwhcZSd',
];

async function main() {
  for (const d of DIGESTS) {
    try {
      const tx = await client.getTransactionBlock({
        digest: d,
        options: { showInput: true, showEffects: true, showEvents: true, showBalanceChanges: true, showObjectChanges: true },
      });
      console.log('TX', d);
      console.log('  sender:', tx.transaction?.data?.sender);
      const pt = tx.transaction?.data?.transaction?.kind === 'ProgrammableTransaction'
        ? tx.transaction.data.transaction
        : tx.transaction?.data?.transaction;
      console.log('  kind:', tx.transaction?.data?.transaction?.kind);
      console.log('  raw inputs count:', pt?.inputs?.length ?? 0);
      // Dump the whole PT for offline inspection
      console.log(JSON.stringify(pt, null, 2));
      console.log('');
    } catch (e) {
      console.error('Error fetching', d, e.message);
    }
  }
}

main();

