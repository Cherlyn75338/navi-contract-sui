import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { FULLNODE, PLACEHOLDERS, PACKAGES } from './config.js';

const provider = new SuiClient({ url: FULLNODE || getFullnodeUrl('mainnet') });

function computeSeized(
  debtToCover: bigint,
  debtPriceInt: bigint, debtPriceDec: number,
  collPriceInt: bigint, collPriceDec: number,
  bonusBps: number // e.g., 10500 for 5% bonus
): bigint {
  const target = 18;
  // scale prices to target
  const adj = (v: bigint, d: number) => {
    if (d > target) return v / (10n ** BigInt(d - target));
    if (d < target) return v * (10n ** BigInt(target - d));
    return v;
  };
  const dp = adj(debtPriceInt, debtPriceDec);
  const cp = adj(collPriceInt, collPriceDec);
  const bonus = BigInt(bonusBps) * (10n ** 14n); // convert bps to 1e18 scale: bps*1e14
  // seized = debtToCover * debtPrice * bonus / (1e18) / collPrice
  const num = debtToCover * dp * bonus;
  const den = (10n ** 18n) * cp;
  return num / den;
}

async function main() {
  const pkg = PACKAGES[0];
  const liquidator = '0x<fill-your-address>'; // sender placeholder
  const borrower = '0x<borrower>'; // victim
  const debtCoinType = '0x2::coin::Coin<0x<usdc-coin-type>>';
  const collCoinType = '0x2::sui::SUI';
  const debtToCoverU64 = 1000000; // placeholder
  const reserveIndex = 0; // placeholder
  const clockObjId = '0x<clock>';

  const sim = await provider.devInspectMoveCall({
    sender: liquidator,
    package: pkg,
    module: PLACEHOLDERS.lendingModule,
    function: PLACEHOLDERS.fnLiquidate,
    typeArguments: [debtCoinType, collCoinType],
    arguments: [clockObjId, PLACEHOLDERS.oracleObjectId, PLACEHOLDERS.storageObjectId, PLACEHOLDERS.poolObjectId, reserveIndex, borrower, debtToCoverU64]
  });
  console.log('devInspect liquidation result:', JSON.stringify(sim.results, null, 2));
  // Compare seized collateral amount in results (decode per ABI) to computeSeized(...)
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

