import { SuiClient, getFullnodeUrl, TransactionBlock } from '@mysten/sui.js';

const ORACLE_PKG  = '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1';
const LENDING_PKG = '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';
const CLOCK_ID = '0x6';
const SENDER = process.env.SENDER || '0x1111111111111111111111111111111111111111';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function devInspect(target: string, args: (string|number|bigint)[], priceOracleId: string) {
  const tx = new TransactionBlock();
  tx.moveCall({
    target,
    arguments: args.map((a) => (typeof a === 'string' && a.startsWith('0x') ? tx.object(a) : tx.pure(a))),
  });
  return client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
}

(async () => {
  // Query recent PriceUpdated events to discover the active PriceOracle object id and oracle ids
  const evType = `${ORACLE_PKG}::oracle_pro::PriceRegulation`; // often emitted; fallback to PriceUpdated
  let priceOracleId: string | null = null;
  let oracleIds = new Set<number>();

  try {
    const events = await client.queryEvents({ query: { MoveModule: { package: ORACLE_PKG, module: 'oracle' } }, limit: 50 });
    for (const e of events.data) {
      if (e.type.endsWith('::oracle::PriceUpdated')) {
        const fields: any = e.parsedJson;
        if (fields?.price_oracle) priceOracleId = fields.price_oracle;
        if (typeof fields?.id === 'number') oracleIds.add(fields.id);
      }
    }
  } catch {}

  if (!priceOracleId) {
    console.error('Could not auto-discover PriceOracle object id from events. Please set PRICE_ORACLE_ID');
    process.exit(1);
  }

  console.log('Discovered PriceOracle:', priceOracleId);

  // If no oracle ids from events, try a small range [0..15]
  if (oracleIds.size === 0) {
    for (let i = 0; i < 16; i++) oracleIds.add(i);
  }

  for (const oid of oracleIds) {
    try {
      const tp = await devInspect(`${ORACLE_PKG}::oracle::get_token_price`, [CLOCK_ID, priceOracleId, oid], priceOracleId);
      const returns = tp.results?.[0]?.returnValues;
      if (!returns?.length) continue;
      const fresh = Number(returns[0][0]) !== 0;
      const price = BigInt(returns[0][1]);
      const dec = Number(returns[0][2]);
      if (!fresh || price === 0n) continue;

      console.log(`oracleId=${oid}, dec=${dec}, price=${price}`);

      const amount9d = 1_000_000_000n;
      const cv = await devInspect(`${LENDING_PKG}::calculator::calculate_value`, [CLOCK_ID, priceOracleId, amount9d.toString(), oid], priceOracleId);
      const valueCalc = BigInt(cv.results![0].returnValues![0][0]);
      const expected9d = (amount9d * price) / 1_000_000_000n;

      const ca = await devInspect(`${LENDING_PKG}::calculator::calculate_amount`, [CLOCK_ID, priceOracleId, price.toString(), oid], priceOracleId);
      const amtFromValue = BigInt(ca.results![0].returnValues![0][0]);

      const factor = dec === 9 ? 1 : Math.pow(10, 9 - dec);
      console.log({ oracleId: oid, dec, valueCalc: valueCalc.toString(), expected9d: expected9d.toString(), amtFromValue: amtFromValue.toString(), factor });
      if (dec !== 9) {
        console.log('MISMATCH DETECTED');
        break;
      }
    } catch {}
  }
})();
