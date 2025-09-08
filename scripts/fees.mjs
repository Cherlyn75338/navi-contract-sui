import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Transaction } from '@mysten/sui.js/transactions';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// Fill these before running
const params = {
  pkgLending: '',
  storageId: '',
  clockId: '0x6',
  configId: '',
  poolId: '',
  coinType: '0x2::sui::SUI',
  sender: '',
  chunks: 5,
  amountPerChunk: '1',
};

async function main() {
  const tx = new Transaction();
  for (let i = 0; i < params.chunks; i += 1) {
    const [bal, receipt] = tx.moveCall({
      target: `${params.pkgLending}::lending::flash_loan_with_ctx`,
      typeArguments: [params.coinType],
      arguments: [tx.object(params.configId), tx.object(params.poolId), tx.pure.u64(params.amountPerChunk)],
    });
    tx.moveCall({
      target: `${params.pkgLending}::lending::flash_repay_with_ctx`,
      typeArguments: [params.coinType],
      arguments: [tx.object(params.clockId), tx.object(params.storageId), tx.object(params.poolId), receipt, bal],
    });
  }
  const res = await client.devInspectTransactionBlock({ sender: params.sender, transactionBlock: tx });
  console.dir(res.effects, { depth: null });
}

main();

