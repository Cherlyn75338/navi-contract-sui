import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const PKG_LENDING = process.env.PKG_LENDING!; // 0x81c4...
const PKG_FLASH = process.env.PKG_FLASH!;     // 0x06007a...
const CONFIG_ID = process.env.FL_CONFIG_ID!;  // 0x3672...
const POOL_ID = process.env.FL_POOL_ID!;      // pool for the same asset
const STORAGE_ID = process.env.STORAGE_ID!;   // storage used by lending/flash_loan
const COIN_TYPE = process.env.COIN_TYPE!;     // asset TypeArg
const CLOCK_ID = process.env.CLOCK_ID || '0x6';
const SENDER = process.env.SENDER!;

async function main() {
  const tx = new TransactionBlock();

  // Borrow
  const [balance, receipt] = tx.moveCall({
    target: `${PKG_LENDING}::lending::flash_loan_with_ctx`,
    typeArguments: [COIN_TYPE],
    arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure.u64('1')],
  });

  // Direct repay via flash_loan::repay on the same stack
  tx.moveCall({
    target: `${PKG_FLASH}::flash_loan::repay`,
    typeArguments: [COIN_TYPE],
    arguments: [tx.object(CLOCK_ID), tx.object(STORAGE_ID), tx.object(POOL_ID), receipt, balance],
  });

  const res = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
  console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
