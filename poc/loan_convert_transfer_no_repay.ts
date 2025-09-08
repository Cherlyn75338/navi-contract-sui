import { SuiClient, getFullnodeUrl, TransactionBlock } from '@mysten/sui.js';

const PACKAGE = '<PACKAGE>';
const MODULE = 'lending';
const FUNC = 'flash_loan_with_ctx';
const TYPE = '<COIN_TYPE>';
const CONFIG_ID = '<CONFIG_ID>';
const POOL_ID = '<POOL_ID>';
const AMOUNT = 1_000n;

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function main() {
  const sender = '<ANY_ADDRESS>';
  const tx = new TransactionBlock();

  const [bal, receipt] = tx.moveCall({
    target: `${PACKAGE}::${MODULE}::${FUNC}`,
    typeArguments: [TYPE],
    arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure(AMOUNT)],
  });

  const [coin] = tx.moveCall({
    target: `0x2::coin::from_balance`,
    typeArguments: [TYPE],
    arguments: [bal],
  });
  tx.transferObjects([coin], tx.pure(sender));

  const di = await client.devInspectTransactionBlock({ sender, transactionBlock: tx });
  console.log(JSON.stringify(di.effects, null, 2));
}

main().catch(console.error);

