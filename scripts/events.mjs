import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const PACKAGES = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca',
];

async function fetchAllEvents(moveEventType, limit = 1000) {
  const out = [];
  let cursor = null;
  while (out.length < limit) {
    const res = await client.queryEvents({
      query: { MoveEventType: moveEventType },
      cursor,
      limit: 50,
      order: 'descending',
    });
    out.push(...res.data);
    if (!res.hasNextPage || !res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return out;
}

async function getObjectFields(objectId) {
  const obj = await client.getObject({ id: objectId, options: { showContent: true } });
  const fields = obj?.data?.content?.fields;
  return fields || null;
}

async function main() {
  for (const pkg of PACKAGES) {
    console.log('PACKAGE', pkg);
    const cfgType = `${pkg}::flash_loan::ConfigCreated`;
    const assetCfgType = `${pkg}::flash_loan::AssetConfigCreated`;
    const cfgEvents = await fetchAllEvents(cfgType, 200);
    console.log('  ConfigCreated events:', cfgEvents.length);
    const cfgIds = cfgEvents.map(e => e.parsedJson?.id).filter(Boolean);
    console.log('  Config object ids (unique):', Array.from(new Set(cfgIds)).join(','));

    const assetEvents = await fetchAllEvents(assetCfgType, 5000);
    console.log('  AssetConfigCreated events:', assetEvents.length);
    const assets = [];
    for (const ev of assetEvents) {
      const configId = ev.parsedJson?.config_id;
      const assetId = ev.parsedJson?.asset_id;
      if (!assetId) continue;
      try {
        const fields = await getObjectFields(assetId);
        if (!fields) continue;
        const coinType = fields.coin_type?.fields?.bytes ?
          // ascii::String in Sui stores bytes
          new TextDecoder().decode(
            Uint8Array.from(fields.coin_type.fields.bytes)
          ) : 'unknown';
        const poolId = fields.pool_id;
        const rateSupplier = fields.rate_to_supplier;
        const rateTreasury = fields.rate_to_treasury;
        const min = fields.min;
        const max = fields.max;
        assets.push({ configId, assetId, coinType, poolId, rateSupplier, rateTreasury, min, max });
      } catch (e) {
        // ignore parsing errors
      }
    }
    // Group assets by configId
    const byCfg = assets.reduce((acc, a) => {
      const k = a.configId;
      if (!acc[k]) acc[k] = [];
      acc[k].push(a);
      return acc;
    }, {});
    for (const [cfg, list] of Object.entries(byCfg)) {
      console.log(`  Config ${cfg} assets:`);
      for (const a of list) {
        console.log(`    - coin=${a.coinType} pool=${a.poolId} min=${a.min} max=${a.max} supplierRate=${a.rateSupplier} treasuryRate=${a.rateTreasury}`);
      }
    }

    // Additional discovery via pool/storage/flash_loan events
    const poolWithdrawReserveType = `${pkg}::pool::PoolWithdrawReserve`;
    const storageWithdrawTreasuryType = `${pkg}::storage::WithdrawTreasuryEvent`;
    const flashLoanType = `${pkg}::flash_loan::FlashLoan`;
    const flashRepayType = `${pkg}::flash_loan::FlashRepay`;

    const poolW = await fetchAllEvents(poolWithdrawReserveType, 200);
    const storW = await fetchAllEvents(storageWithdrawTreasuryType, 200);
    const fl = await fetchAllEvents(flashLoanType, 200);
    const fr = await fetchAllEvents(flashRepayType, 200);

    const poolIds = new Set();
    for (const ev of poolW) {
      const pj = ev.parsedJson || {};
      if (pj.poolId) poolIds.add(pj.poolId);
    }
    for (const ev of storW) {
      const pj = ev.parsedJson || {};
      if (pj.poolId) poolIds.add(pj.poolId);
    }
    console.log('  Discovered poolIds via events:', Array.from(poolIds).join(','));
    console.log('  FlashLoan events:', fl.length, 'FlashRepay events:', fr.length);
    console.log('');
  }
}

main();

