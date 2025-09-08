import { SuiClient, getFullnodeUrl, /* no txb */ } from '@mysten/sui.js/client';

const ORACLE_PKG  = '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1';
const LENDING_PKG = '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';
const CLOCK_ID = '0x6';
const SENDER = process.env.SENDER || '0x1111111111111111111111111111111111111111';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function devInspect(target, args) {
  const tx = new TransactionBlock();
  tx.moveCall({
    target,
    arguments: args.map((a) => (typeof a === 'string' && a.startsWith('0x') ? tx.object(a) : tx.pure(a))),
  });
  return client.devInspect/* no txb */({ sender: SENDER, transactionBlock: tx });
}

async function discoverPriceOracleId() {
  // Try querying recent events from oracle module
  try {
    const events = await client.queryEvents({ query: { MoveModule: { package: ORACLE_PKG, module: 'oracle' } }, limit: 50 });
    for (const e of events.data) {
      if (e.type.endsWith('::oracle::PriceUpdated') && e.parsedJson?.price_oracle) {
        return e.parsedJson.price_oracle;
      }
    }
  } catch {}
  return null;
}

(async () => {
  const priceOracleId = process.env.PRICE_ORACLE_ID || (await discoverPriceOracleId());
  if (!priceOracleId) {
    console.error('Could not discover PRICE_ORACLE_ID. Set env PRICE_ORACLE_ID.');
    process.exit(1);
  }
  console.log('PRICE_ORACLE_ID', priceOracleId);

  // Probe oracle ids 0..15
  for (let oid = 0; oid < 16; oid++) {
    try {
      const tp = await devInspect(`${ORACLE_PKG}::oracle::get_token_price`, [CLOCK_ID, priceOracleId, oid]);
      const returns = tp.results?.[0]?.returnValues;
      if (!returns?.length) continue;
      const fresh = Number(returns[0][0]) !== 0;
      const price = BigInt(returns[0][1]);
      const dec = Number(returns[0][2]);
      if (!fresh || price === 0n) continue;

      console.log(`oracleId=${oid}, dec=${dec}, price=${price}`);

      const amount9d = 1_000_000_000n;
      const cv = await devInspect(`${LENDING_PKG}::calculator::calculate_value`, [CLOCK_ID, priceOracleId, amount9d.toString(), oid]);
      const valueCalc = BigInt(cv.results[0].returnValues[0][0]);
      const expected9d = (amount9d * price) / 1_000_000_000n;

      const ca = await devInspect(`${LENDING_PKG}::calculator::calculate_amount`, [CLOCK_ID, priceOracleId, price.toString(), oid]);
      const amtFromValue = BigInt(ca.results[0].returnValues[0][0]);

      const factor = dec === 9 ? 1 : Math.pow(10, 9 - dec);
      console.log({ oracleId: oid, dec, valueCalc: valueCalc.toString(), expected9d: expected9d.toString(), amtFromValue: amtFromValue.toString(), factor });
      if (dec !== 9) {
        console.log('MISMATCH DETECTED');
        break;
      }
    } catch (e) {
      // ignore
    }
  }
})();
