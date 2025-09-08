import { SuiClient } from '@mysten/sui.js/client';

const STORAGE_ID = process.env.STORAGE_ID || '';
const RESERVE_ID = parseInt(process.env.RESERVE_ID || '0');

async function run() {
  if (!STORAGE_ID) throw new Error('Set STORAGE_ID');
  const c = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });

  const storageObj = await c.getObject({ id: STORAGE_ID, options: { showContent: true } });
  const content: any = storageObj.data?.content;
  if (!content || content.dataType !== 'moveObject') throw new Error('No content');

  // Find reserves table object id
  const reservesTableId = content.fields?.reserves?.fields?.id?.id ?? content.fields?.reserves?.fields?.id;
  if (!reservesTableId) throw new Error('Reserves table id not found');
  console.log('Reserves table id:', reservesTableId);

  // List dynamic fields under reserves table
  const dfPage = await c.getDynamicFields({ parentId: reservesTableId, limit: 50 });
  console.log('Dynamic fields count:', dfPage.data.length);

  // Try to locate the entry whose key matches RESERVE_ID (u8). We inspect names to find a numeric key.
  let targetName: any | null = null;
  for (const info of dfPage.data) {
    const name = info.name as any;
    // Heuristic: when key is u8, name.value may be a number or wrapped under fields.value
    const val = (name.value as any)?.value ?? (name.value as any)?.fields?.value ?? name.value;
    if (val === RESERVE_ID || Number(val) === RESERVE_ID) {
      targetName = name;
      break;
    }
  }
  if (!targetName) {
    console.log('Could not match RESERVE_ID via name; printing first 3 entries and exiting.');
    for (const info of dfPage.data.slice(0, 3)) {
      const obj = await c.getDynamicFieldObject({ parentId: reservesTableId, name: info.name });
      console.log('Entry:', JSON.stringify(obj, null, 2));
    }
    return;
  }

  const entryObj = await c.getDynamicFieldObject({ parentId: reservesTableId, name: targetName });
  // The value is a Move object of type ReserveData; read its last_update_timestamp, current indices, treasury_balance
  const reserveContent: any = entryObj.data?.content;
  if (!reserveContent || reserveContent.dataType !== 'moveObject') throw new Error('No reserve content');
  const f = reserveContent.fields;
  console.log('reserve.current_supply_index:', f.current_supply_index);
  console.log('reserve.current_borrow_index:', f.current_borrow_index);
  console.log('reserve.last_update_timestamp:', f.last_update_timestamp);
  console.log('reserve.treasury_balance:', f.treasury_balance);
}

run().catch((e) => { console.error(e); process.exit(1); });

