import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { FULLNODE, PACKAGES, PLACEHOLDERS, ASSETS, BORROWERS } from './config.js';
import { provider as sharedProvider, normalizeValue, getCoinDecimals, bigintFromU256Return, ratioDelta } from './utils.js';

const provider = new SuiClient({ url: FULLNODE || getFullnodeUrl('mainnet') });

type ValuationRow = {
  user: string;
  asset: string;
  coinType: string;
  Dc: number;
  priceInt?: bigint;
  Dp?: number;
  onchainCollateral?: bigint;
  onchainLoan?: bigint;
  offchainCollateral?: bigint;
  offchainLoan?: bigint;
  deltaCollateral?: number;
  deltaLoan?: number;
};

async function devInspectValue(pkg: string, fn: string, args: any[], module: string, typeArgs?: string[]) {
  const r = await provider.devInspectMoveCall({ sender: BORROWERS[0] || '0x0', package: pkg, module, function: fn, arguments: args, typeArguments: typeArgs });
  return r;
}

async function fetchPrice(pkg: string, coinType: string) {
  // Placeholder call shape; adjust per discovered ABI
  const r = await provider.devInspectMoveCall({
    sender: '0x0',
    package: pkg,
    module: PLACEHOLDERS.oracleModule,
    function: PLACEHOLDERS.fnGetPrice,
    typeArguments: [coinType],
    arguments: [PLACEHOLDERS.oracleObjectId]
  });
  // Expect returnValues[0] = priceInt, returnValues[1] = priceDecimals (u64)
  const ret = r.results?.[0]?.returnValues || [];
  if (ret.length === 0) throw new Error('price getter returned no values');
  const priceInt = BigInt(ret[0][0]);
  const priceDecimals = Number(ret[1]?.[0] || 9);
  return { priceInt, priceDecimals };
}

async function userValue(pkg: string, user: string, coinType: string, assetIndex: number, Dc: number, priceInt: bigint, Dp: number): Promise<ValuationRow> {
  const storage = PLACEHOLDERS.storageObjectId;
  const oracle = PLACEHOLDERS.oracleObjectId;
  // On-chain values via logic
  const coll = await devInspectValue(pkg, PLACEHOLDERS.fnUserCollateralValue, [oracle, storage, assetIndex, user], PLACEHOLDERS.logicModule, [coinType]);
  const loan = await devInspectValue(pkg, PLACEHOLDERS.fnUserLoanValue, [oracle, storage, assetIndex, user], PLACEHOLDERS.logicModule, [coinType]);
  const onchainCollateral = BigInt(coll.results?.[0]?.returnValues?.[0]?.[0] || 0);
  const onchainLoan = BigInt(loan.results?.[0]?.returnValues?.[0]?.[0] || 0);

  // Off-chain recompute: pull user balances and indexes
  const ub = await provider.devInspectMoveCall({
    sender: user,
    package: pkg,
    module: PLACEHOLDERS.storageModule,
    function: PLACEHOLDERS.fnGetUserBalance,
    typeArguments: [coinType],
    arguments: [storage, assetIndex, user]
  });
  const idx = await provider.devInspectMoveCall({
    sender: user,
    package: pkg,
    module: PLACEHOLDERS.storageModule,
    function: PLACEHOLDERS.fnGetIndex,
    typeArguments: [coinType],
    arguments: [storage, assetIndex]
  });
  const borrowScaled = BigInt(ub.results?.[0]?.returnValues?.[0]?.[0] || 0); // u256
  const supplyScaled = BigInt(ub.results?.[0]?.returnValues?.[1]?.[0] || 0);
  const borrowIndex = BigInt(idx.results?.[0]?.returnValues?.[0]?.[0] || 1);
  const supplyIndex = BigInt(idx.results?.[0]?.returnValues?.[1]?.[0] || 1);
  // Assume ray=1e27 if needed; placeholder scaling
  const RAY = 10n ** 27n;
  const borrowNormal = (borrowScaled * borrowIndex) / RAY;
  const supplyNormal = (supplyScaled * supplyIndex) / RAY;

  const offC = normalizeValue(supplyNormal, Dc, priceInt, Dp);
  const offL = normalizeValue(borrowNormal, Dc, priceInt, Dp);

  const row: ValuationRow = {
    user,
    asset: String(assetIndex),
    coinType,
    Dc,
    priceInt,
    Dp,
    onchainCollateral,
    onchainLoan,
    offchainCollateral: offC.valueRaw,
    offchainLoan: offL.valueRaw,
    deltaCollateral: ratioDelta(onchainCollateral, offC.valueRaw),
    deltaLoan: ratioDelta(onchainLoan, offL.valueRaw)
  };
  return row;
}

async function main() {
  const pkg = PACKAGES[0]; // start with first package; adjust as needed
  const rows: ValuationRow[] = [];
  for (const asset of ASSETS) {
    const Dc = await getCoinDecimals(asset.coinType);
    const { priceInt, priceDecimals } = await fetchPrice(pkg, asset.coinType);
    for (const user of BORROWERS) {
      // asset index placeholder: fill with real index per reserve mapping
      const assetIndex = 0; // TODO: replace by discovered index
      const r = await userValue(pkg, user, asset.coinType, assetIndex, Dc, priceInt, priceDecimals);
      rows.push(r);
    }
  }
  console.table(rows.map(r => ({
    user: r.user,
    asset: r.asset,
    Dc: r.Dc,
    Dp: r.Dp,
    deltaCollateral: r.deltaCollateral?.toFixed(8),
    deltaLoan: r.deltaLoan?.toFixed(8)
  })));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

