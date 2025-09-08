import { SuiClient, getFullnodeUrl, TransactionBlock } from '@mysten/sui.js';

const PACKAGE = '<PACKAGE>';
const MODULE = 'lending';
const LOAN = 'flash_loan_with_ctx';
const REPAY = 'flash_repay_with_ctx';
const TYPE = '<COIN_TYPE>';
const CONFIG_ID = '<CONFIG_ID>';
const POOL_ID = '<POOL_ID>';
const STORAGE_ID = '<STORAGE_ID>';
const CLOCK_ID = '0x6';
const AMOUNT = 1_000n;

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function main() {
  const sender = '<ANY_ADDRESS>';
  const tx = new TransactionBlock();

  const [bal, receipt] = tx.moveCall({
    target: `${PACKAGE}::${MODULE}::${LOAN}`,
    typeArguments: [TYPE],
    arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure(AMOUNT)],
  });

  const [remaining] = tx.moveCall({
    target: `${PACKAGE}::${MODULE}::${REPAY}`,
    typeArguments: [TYPE],
    arguments: [tx.object(CLOCK_ID), tx.object(STORAGE_ID), tx.object(POOL_ID), receipt, bal],
  });

  tx.moveCall({
    target: `0x2::balance::destroy_zero`,
    typeArguments: [TYPE],
    arguments: [remaining],
  });

  const di = await client.devInspectTransactionBlock({ sender, transactionBlock: tx });
  console.log(JSON.stringify(di.effects, null, 2));
}

main().catch(console.error);

