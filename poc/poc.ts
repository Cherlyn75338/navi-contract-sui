import { SuiClient, getFullnodeUrl, TransactionBlock } from '@mysten/sui.js';

const LENDING_PKG = '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';
const ORACLE_PKG  = '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1';
const CLOCK_ID = '0x6';

// Fill these from mainnet (shared objects)
const STORAGE_ID = process.env.STORAGE_ID || '';
const PRICE_ORACLE_ID = process.env.PRICE_ORACLE_ID || '';
const SENDER = process.env.SENDER || '0x1111111111111111111111111111111111111111';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function devInspect(target: string, args: (string|number|bigint)[]) {
  const tx = new TransactionBlock();
  tx.moveCall({
    target,
    arguments: args.map((a) => (typeof a === 'string' && a.startsWith('0x') ? tx.object(a) : tx.pure(a))),
  });
  const res = await client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
  if (!res.results?.length || !res.results[0].returnValues?.length) {
    throw new Error(`No return values for ${target}`);
  }
  return res.results[0].returnValues;
}

async function main() {
  if (!STORAGE_ID || !PRICE_ORACLE_ID) {
    console.error('Please set STORAGE_ID and PRICE_ORACLE_ID env vars.');
    process.exit(1);
  }

  // get_reserves_count
  const rc = await devInspect(`${LENDING_PKG}::storage::get_reserves_count`, [STORAGE_ID]);
  const reservesCount = Number(rc[0][0]);
  console.log('reservesCount', reservesCount);

  for (let i = 0; i < reservesCount; i++) {
    const rid = await devInspect(`${LENDING_PKG}::storage::get_oracle_id`, [STORAGE_ID, i]);
    const oracleId = Number(rid[0][0]);

    const dec = await devInspect(`${ORACLE_PKG}::oracle::safe_decimal`, [PRICE_ORACLE_ID, oracleId]);
    const oracleDec = Number(dec[0][0]);

    const tp = await devInspect(`${ORACLE_PKG}::oracle::get_token_price`, [CLOCK_ID, PRICE_ORACLE_ID, oracleId]);
    const price = BigInt(tp[0][1]);
    const fresh = Number(tp[0][0]) !== 0; // non-zero bool

    console.log(`reserve ${i}: oracleId=${oracleId}, oracleDec=${oracleDec}, fresh=${fresh}, price=${price}`);

    if (oracleDec !== 9) {
      const amount9d = 1_000_000_000n;
      const cv = await devInspect(`${LENDING_PKG}::calculator::calculate_value`, [CLOCK_ID, PRICE_ORACLE_ID, amount9d.toString(), oracleId]);
      const valueCalc = BigInt(cv[0][0]);
      const expected9d = (amount9d * price) / 1_000_000_000n;

      const ca = await devInspect(`${LENDING_PKG}::calculator::calculate_amount`, [CLOCK_ID, PRICE_ORACLE_ID, price.toString(), oracleId]);
      const amtFromValue = BigInt(ca[0][0]);

      console.log({ i, oracleDec, price: price.toString(), valueCalc: valueCalc.toString(), expected9d: expected9d.toString(), amtFromValue: amtFromValue.toString(), factor: 10 ** (9 - oracleDec) });
      return;
    }
  }

  console.log('All reserves have oracle_dec == 9 (safe-by-config today).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
