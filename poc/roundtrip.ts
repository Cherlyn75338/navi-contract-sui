import { getFullnodeUrl, SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });
const SENDER = "0x0000000000000000000000000000000000000000000000000000000000000001";

const PKG_POOL = "0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1"; // has pool::convert_amount

async function convert(pkg: string, amount: bigint, fromDec: number, toDec: number) {
  const tx = new TransactionBlock();
  const call = tx.moveCall({
    target: `${pkg}::pool::convert_amount`,
    arguments: [tx.pure.u64(amount.toString()), tx.pure.u8(fromDec), tx.pure.u8(toDec)],
  });
  const res = await client.devInspectTransactionBlock({ transactionBlock: tx, sender: SENDER });
  const first = res.results?.[0]?.returnValues?.[0];
  if (!first) throw new Error("no return value");
  // returnValues: [bytes, type]
  const [bytes /*, type*/] = first as [number[], string];
  // bytes are LE-encoded bcs u64
  const buf = Buffer.from(bytes);
  const val = buf.readBigUInt64LE(0);
  return val;
}

async function roundtripTest(fromDec: number, upto: number) {
  const drifts: Array<{ x: number; n: bigint; u: bigint } > = [];
  for (let x = 1; x <= upto; x++) {
    const n = await convert(PKG_POOL, BigInt(x), fromDec, 9);
    const u = await convert(PKG_POOL, n, 9, fromDec);
    if (u !== BigInt(x)) drifts.push({ x, n, u });
  }
  return drifts;
}

(async () => {
  const cases = [6, 8, 18];
  for (const d of cases) {
    try {
      const drifts = await roundtripTest(d, 100);
      const count = drifts.length;
      const sample = drifts.slice(0, 5).map((r) => ({ x: r.x, n: r.n.toString(), u: r.u.toString() }));
      console.log(JSON.stringify({ decimals: d, count, sample }, null, 2));
      const b = await roundtripBoundary(d);
      const bcount = b.length;
      const bsample = b.slice(0, 5).map((r) => ({ x: r.x.toString(), n: r.n.toString(), u: r.u.toString() }));
      console.log(JSON.stringify({ decimals_boundary: d, count: bcount, sample: bsample }, null, 2));
    } catch (e) {
      console.error("error for decimals", d, e);
    }
  }
})();

async function roundtripBoundary(fromDec: number) {
  const drifts: Array<{ x: bigint; n: bigint; u: bigint } > = [];
  const pow10: bigint[] = [];
  for (let k = 0; k <= 19; k++) {
    const v = BigInt(10) ** BigInt(k);
    pow10.push(v);
  }
  const candidates = new Set<bigint>();
  for (const v of pow10) {
    if (v > 0n) candidates.add(v - 1n);
    candidates.add(v);
    candidates.add(v + 1n);
  }
  for (const x of candidates) {
    if (x <= 0n) continue;
    if (x > 18446744073709551615n) continue; // u64 max
    const n = await convert(PKG_POOL, x, fromDec, 9);
    const u = await convert(PKG_POOL, n, 9, fromDec);
    if (u !== x) drifts.push({ x, n, u });
  }
  return drifts;
}
