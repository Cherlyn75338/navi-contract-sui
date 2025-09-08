import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Transaction } from '@mysten/sui.js/transactions';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// Fill these before running
const params = {
  pkgLending: '',           // e.g., '0x81c4...'
  storageId: '',            // storage::Storage
  clockId: '0x6',           // 0x2::clock::Clock object id
  configId: '',             // flash_loan::Config
  poolId: '',               // pool::Pool<T>
  coinType: '0x2::sui::SUI',
  amount: '1',
  sender: '',
};

async function main() {
  const tx = new Transaction();

  const [balance, receipt] = tx.moveCall({
    target: `${params.pkgLending}::lending::flash_loan_with_ctx`,
    typeArguments: [params.coinType],
    arguments: [tx.object(params.configId), tx.object(params.poolId), tx.pure.u64(params.amount)],
  });

  const remaining = tx.moveCall({
    target: `${params.pkgLending}::lending::flash_repay_with_ctx`,
    typeArguments: [params.coinType],
    arguments: [tx.object(params.clockId), tx.object(params.storageId), tx.object(params.poolId), receipt, balance],
  });

  // Send leftover, if any
  tx.transferObjects([remaining], tx.pure.address(params.sender));

  const res = await client.devInspectTransactionBlock({ sender: params.sender, transactionBlock: tx });
  console.dir(res.effects, { depth: null });
}

main();

