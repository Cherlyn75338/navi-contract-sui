import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// Fill these before running
const params = {
  pkgLending: '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  configId: '0x3672b2bf471a60c30a03325f104f92fb195c9d337ba58072dce764fe2aa5e2dc',
  poolId: '0xa3582097b4c57630046c0c49a88bfc6b202a3ec0a9db5597c31765f7563755a8',
  coinType: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  amount: '1',
  sender: '0x825d7d067cec8fb08387fa0225d2bd144ae8aca9ed890ecc27ac5a2657296c92',
};

async function main() {
  const tx = new TransactionBlock();

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

