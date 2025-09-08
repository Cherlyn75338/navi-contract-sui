import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

const PKG = "0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca";
const MODULE = "lending";
const FUNCS = ["deposit", "withdraw", "borrow", "repay"] as const;

type Row = {
  digest: string;
  tsMs: number;
  func: string;
  events: { type: string }[];
};

async function fetchTxs(func: string, limit = 50): Promise<Row[]> {
  const res = await client.queryTransactionBlocks({
    filter: { MoveFunction: { package: PKG, module: MODULE, function: func } },
    options: { showEvents: true, showInput: true },
    limit,
    order: "descending",
  });
  return (res.data || []).map((tx: any) => ({
    digest: tx.digest,
    tsMs: Number((tx as any).timestampMs || 0),
    func,
    events: (tx.events || []).map((e: any) => ({ type: e.type as string })),
  }));
}

function groupBySecond(rows: Row[]) {
  const map = new Map<number, Row[]>();
  for (const r of rows) {
    const sec = Math.floor(r.tsMs / 1000);
    const arr = map.get(sec) || [];
    arr.push(r);
    map.set(sec, arr);
  }
  return map;
}

async function main() {
  const all: Row[] = [];
  for (const f of FUNCS) {
    const rows = await fetchTxs(f, 100);
    all.push(...rows);
  }
  all.sort((a, b) => a.tsMs - b.tsMs);
  const bySec = groupBySecond(all);
  const secs = Array.from(bySec.keys()).sort((a, b) => a - b);
  for (const s of secs) {
    const rows = bySec.get(s)!;
    const date = new Date(s * 1000).toISOString();
    const funcs = rows.map((r) => r.func);
    const evs = rows.flatMap((r) => r.events.map((e) => e.type));
    const interesting = evs.filter((t) => t.includes("storage") || t.includes("lending") || t.includes("incentive"));
    console.log(`sec=${s} ${date} txs=${rows.length} funcs=${Array.from(new Set(funcs)).join(",")} events=${interesting.length}`);
    for (const r of rows) console.log(`  ${r.func} ${r.digest} events=${r.events.length}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });