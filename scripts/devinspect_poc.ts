import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';

// Utility ray math in bigint
const RAY = 10n ** 27n;
const rayMul = (a: bigint, b: bigint) => (a === 0n || b === 0n) ? 0n : (a * b + (RAY/2n)) / RAY;
const rayDiv = (a: bigint, b: bigint) => {
  if (b === 0n) throw new Error('div0');
  return (a * RAY + (b/2n)) / b;
};

type Pkg = `0x${string}`;

async function fetchNormalized(pkg: Pkg) {
  const client = new SuiClient({ url: getFullnodeUrl('mainnet') });
  const res = await client.getNormalizedMoveModulesByPackage({ package: pkg });
  return res;
}

async function main() {
  const pkgs: Pkg[] = [
    '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
    '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
    '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83',
  ];
  const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

  // Track A: dump module names
  for (const pkg of pkgs) {
    const mods = await fetchNormalized(pkg);
    console.log('Package', pkg, 'modules:', Object.keys(mods));
  }

  // Placeholders for Track B. You must fill these IDs by querying indexer or SuiVision:
  const storageId = '<STORAGE_OBJECT_ID>';
  const oracleId = '<PRICE_ORACLE_OBJECT_ID>';
  const poolId = '<POOL_OBJECT_ID>'; // Pool<T> for chosen coin
  const clockId = '0x6'; // Sui clock object id
  const reserveId = 0; // u8 reserve id for the chosen coin
  const sender = '<YOUR_ADDRESS>'; // dev-inspect sender; no state change occurs

  // Example: snapshot get_total_supply / get_index via dev-inspect move calls would go here.
  // For brevity, show how to build a borrow dev-inspect once amountU64 is computed.

  const amountU64 = 1n; // placeholder; map from normalized arg2 via normal_amount
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${pkgs[0]}::lending::borrow`,
    typeArguments: ['0x2::sui::SUI'], // replace with actual CoinType
    arguments: [
      tx.object(clockId),
      tx.object(oracleId),
      tx.object(storageId),
      tx.object(poolId),
      tx.pure.u8(reserveId),
      tx.pure.u64(Number(amountU64)),
    ],
  });
  const out = await client.devInspectTransactionBlock({ sender, transactionBlock: tx });
  console.log('dev-inspect status:', out.effects?.status, out.error || null);
}

main().catch((e) => { console.error(e); process.exit(1); });

