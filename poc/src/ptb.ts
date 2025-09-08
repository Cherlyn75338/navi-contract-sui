import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64 } from '@mysten/bcs';

const PKG_INCENTIVE = '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1';

const STORAGE_ID = process.env.STORAGE_ID || '';
const ORACLE_ID = process.env.ORACLE_ID || '';
const INCENTIVE_ID = process.env.INCENTIVE_ID || '';
const POOL_ID = process.env.POOL_ID || '';
const COIN_TYPE = process.env.COIN_TYPE || '';
const RESERVE_ID = parseInt(process.env.RESERVE_ID || '0');
const BORROW_AMOUNT = BigInt(process.env.BORROW_AMOUNT || '1000');
const PK_B64 = process.env.SUI_PK_HEX || '';
const COIN_INPUT_ID = process.env.COIN_INPUT_ID || '';

function keypairFromB64(b64: string) {
  const bytes = fromB64(b64);
  return Ed25519Keypair.fromSecretKey(bytes);
}

(async () => {
  if (!STORAGE_ID || !ORACLE_ID || !INCENTIVE_ID || !POOL_ID || !COIN_TYPE) {
    console.error('Fill STORAGE_ID, ORACLE_ID, INCENTIVE_ID, POOL_ID, COIN_TYPE env vars');
    process.exit(1);
  }
  if (!PK_B64 || !COIN_INPUT_ID) {
    console.error('Set SUI_PK_HEX (base64 secret key) and COIN_INPUT_ID');
    process.exit(1);
  }
  const kp = keypairFromB64(PK_B64);
  const sender = kp.getPublicKey().toSuiAddress();
  const c = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });

  const tx = new TransactionBlock();
  tx.setSender(sender);

  tx.moveCall({
    target: `${PKG_INCENTIVE}::incentive_v3::entry_borrow`,
    typeArguments: [COIN_TYPE],
    arguments: [
      tx.object('0x6'),
      tx.object(ORACLE_ID),
      tx.object(STORAGE_ID),
      tx.object(POOL_ID),
      tx.pure.u8(RESERVE_ID),
      tx.pure.u64(BORROW_AMOUNT),
      tx.object(INCENTIVE_ID),
    ],
  });

  tx.moveCall({
    target: `${PKG_INCENTIVE}::incentive_v3::entry_repay`,
    typeArguments: [COIN_TYPE],
    arguments: [
      tx.object('0x6'),
      tx.object(STORAGE_ID),
      tx.object(POOL_ID),
      tx.pure.u8(RESERVE_ID),
      tx.object(COIN_INPUT_ID),
      tx.pure.u64(BORROW_AMOUNT),
      tx.object(INCENTIVE_ID),
    ],
  });

  const res = await c.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: kp,
    options: { showEffects: true, showEvents: true },
    requestType: 'WaitForLocalExecution',
  });
  console.log('PTB digest', res.digest);
  console.log(JSON.stringify(res.effects, null, 2));
})();

