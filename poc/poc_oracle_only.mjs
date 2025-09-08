import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

const ORACLE_PKGS  = [
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f',
];
const LENDING_PKGS = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca',
];
const CLOCK_ID = '0x6';
const SENDER = process.env.SENDER || '0x1111111111111111111111111111111111111111';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

async function devInspect(target, args) {
  const tx = new TransactionBlock();
  tx.moveCall({
    target,
    arguments: args.map((a) => (typeof a === 'string' && a.startsWith('0x') ? tx.object(a) : tx.pure(a))),
  });
  return client.devInspectTransactionBlock({ sender: SENDER, transactionBlock: tx });
}

async function discoverPriceOracleId(oraclePkg) {
  const eventType = `${oraclePkg}::oracle::PriceUpdated`;
  try {
    const events = await client.queryEvents({ query: { MoveEventType: eventType }, limit: 500 });
    for (const e of events.data) {
      const fields = e.parsedJson || {};
      if (fields.price_oracle) return fields.price_oracle;
    }
  } catch (e) {
    try {
      const events = await client.queryEvents({ query: { MoveModule: { package: oraclePkg, module: 'oracle' } }, limit: 1000 });
      for (const e of events.data) {
        if (e.type === eventType && e.parsedJson?.price_oracle) return e.parsedJson.price_oracle;
        if (e.type.endsWith('::oracle::PriceUpdated') && e.parsedJson?.price_oracle) return e.parsedJson.price_oracle;
      }
    } catch {}
  }
  return null;
}

(async () => {
  const ENV_PRICE_ORACLE_ID = process.env.PRICE_ORACLE_ID || '';
  for (const oraclePkg of ORACLE_PKGS) {
    const priceOracleId = ENV_PRICE_ORACLE_ID || (await discoverPriceOracleId(oraclePkg));
    if (!priceOracleId) {
      continue;
    }
    console.log('PRICE_ORACLE_ID', priceOracleId, 'from pkg', oraclePkg);

    // Probe oracle ids 0..63
    for (let oid = 0; oid < 64; oid++) {
      try {
        const tp = await devInspect(`${oraclePkg}::oracle::get_token_price`, [CLOCK_ID, priceOracleId, oid]);
        const returns = tp.results?.[0]?.returnValues;
        if (!returns?.length) continue;
        const fresh = Number(returns[0][0]) !== 0;
        const price = BigInt(returns[0][1]);
        const dec = Number(returns[0][2]);
        if (!fresh || price === 0n) continue;

        console.log(`oracleId=${oid}, dec=${dec}, price=${price}`);

        // Try each candidate lending package for calculator
        for (const lendPkg of LENDING_PKGS) {
          try {
            const amount9d = 1_000_000_000n;
            const cv = await devInspect(`${lendPkg}::calculator::calculate_value`, [CLOCK_ID, priceOracleId, amount9d.toString(), oid]);
            const valueCalc = BigInt(cv.results[0].returnValues[0][0]);
            const expected9d = (amount9d * price) / 1_000_000_000n;

            const ca = await devInspect(`${lendPkg}::calculator::calculate_amount`, [CLOCK_ID, priceOracleId, price.toString(), oid]);
            const amtFromValue = BigInt(ca.results[0].returnValues[0][0]);

            const factor = dec === 9 ? 1 : Math.pow(10, 9 - dec);
            console.log({ oracleId: oid, dec, price: price.toString(), valueCalc: valueCalc.toString(), expected9d: expected9d.toString(), amtFromValue: amtFromValue.toString(), factor, lendPkg });
            if (dec !== 9) {
              console.log('MISMATCH DETECTED');
              process.exit(0);
            }
          } catch {}
        }
      } catch (e) {
        // ignore errors and continue
      }
    }
  }
  console.error('No PriceOracle found or no mismatch detected in probed range.');
  process.exit(1);
})();
