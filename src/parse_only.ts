import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const PKG_LENDING = process.env.PKG_LENDING!;
const PKG_FLASH = process.env.PKG_FLASH!;
const CONFIG_ID = process.env.FL_CONFIG_ID!;
const POOL_ID = process.env.FL_POOL_ID!;
const COIN_TYPE = process.env.COIN_TYPE!;
const SENDER = process.env.SENDER!;

async function main() {
  const tx = new TransactionBlock();
  const [balance, receipt] = tx.moveCall({
    target: `${PKG_LENDING}::lending::flash_loan_with_ctx`,
    typeArguments: [COIN_TYPE],
    arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure.u64('1')],
  });

  const parsed = tx.moveCall({
    target: `${PKG_FLASH}::flash_loan::parsed_receipt`,
    typeArguments: [COIN_TYPE],
    arguments: [receipt],
  });

  const res = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
  console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
