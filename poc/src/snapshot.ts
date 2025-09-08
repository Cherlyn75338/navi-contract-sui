import { SuiClient } from '@mysten/sui.js/client';

const PKG_STORAGE = '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';

const STORAGE_ID = process.env.STORAGE_ID || '';
const RESERVE_ID = parseInt(process.env.RESERVE_ID || '0');

async function devInspectGetters(label: string) {
  const c = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });
  if (!STORAGE_ID) throw new Error('Set STORAGE_ID env var');

  async function call(func: string, args: any[]) {
    const { TransactionBlock } = await import('@mysten/sui.js/transactions');
    const tx = new TransactionBlock();
    const callArgs = args.map((a) => (typeof a === 'string' && a.startsWith('0x') ? tx.object(a) : tx.pure(a)));
    tx.moveCall({ target: `${PKG_STORAGE}::storage::${func}`, arguments: callArgs });
    // Provide gas price 0 to devInspect per SDK signature (sender, tx, gasPrice?, epoch?)
    const res = await c.devInspectTransactionBlock({ sender: '0x0', transactionBlock: tx, gasPrice: 1n } as any);
    return res;
  }

  const idx = await call('get_index', [STORAGE_ID, RESERVE_ID]);
  const ts = await call('get_last_update_timestamp', [STORAGE_ID, RESERVE_ID]);
  const tr = await call('get_treasury_balance', [STORAGE_ID, RESERVE_ID]);

  console.log(label, 'get_index', JSON.stringify(idx, null, 2));
  console.log(label, 'get_last_update_timestamp', JSON.stringify(ts, null, 2));
  console.log(label, 'get_treasury_balance', JSON.stringify(tr, null, 2));
}

(async () => {
  await devInspectGetters('snapshot');
})();

