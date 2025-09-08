import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { FULLNODE, PACKAGES } from './config.js';

const client = new SuiClient({ url: FULLNODE || getFullnodeUrl('mainnet') });
const LIGHT = process.env.LIGHT !== '0';

type SharedObj = { id: string; objectType: string; createdBy?: string };
type CandidateObj = SharedObj & { ownerKind?: string };

function extractCoinTypesFromEventType(eventType: string): string[] {
  const results: string[] = [];
  // match coin::Coin<...> including nested generics
  const regex = /0x[0-9a-fA-F]+::coin::Coin<([^>]+)>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(eventType)) !== null) {
    const inner = match[1];
    results.push(inner.trim());
  }
  return results;
}

function looksLikeStorage(type: string): boolean {
  return /storage/i.test(type) || /config/i.test(type) || /state/i.test(type);
}

function looksLikeOracle(type: string): boolean {
  return /oracle/i.test(type) || /price/i.test(type);
}

function looksLikePool(type: string): boolean {
  return /pool/i.test(type) || /market/i.test(type) || /reserve/i.test(type);
}

async function discoverForPackage(pkg: string) {
  const out: any = { package: pkg, modules: [], functionsByModule: {}, sharedObjects: [], objectCandidates: [], eventTypes: [], coinTypes: [], candidates: { liquidationFns: [], storageTypes: [], oracleTypes: [], poolTypes: [] }, structsByModule: {}, fnParams: {} };

  // Modules and functions
  let data: any = {};
  try {
    const modules: any = await (client as any).getNormalizedMoveModulesByPackage({ package: pkg });
    data = modules?.data ?? modules ?? {};
    // When returned as a map: { [moduleName]: { exposedFunctions: { [fnName]: fn } } }
    if (!Array.isArray(data) && typeof data === 'object') {
      for (const [name, mod] of Object.entries<any>(data)) {
        out.modules.push(name);
        const fnMap = mod?.exposedFunctions ?? {};
        const fnNames = Object.keys(fnMap);
        out.functionsByModule[name] = fnNames;
        // capture structs
        const structs = mod?.structs ?? {};
        const structEntries = Array.isArray(structs) ? structs.map((s: any) => [s.name, s]) : Object.entries<any>(structs);
        out.structsByModule[name] = structEntries.map(([sname, sdef]: any) => ({ name: sname, typeParams: (sdef?.typeParameters || []).length, abilities: sdef?.abilities }));
        for (const fn of fnNames) {
          const fnName = String(fn).toLowerCase();
          if (fnName.includes('liquid')) out.candidates.liquidationFns.push(`${name}::${fn}`);
        }
      }
    } else if (Array.isArray(data)) {
      for (const m of data) {
        const name: string = m.module?.name ?? '<unknown>';
        out.modules.push(name);
        const fns = m.module?.exposedFunctions || [];
        const names = fns.map((f: any) => f.name);
        out.functionsByModule[name] = names;
        out.structsByModule[name] = (m.module?.structs || []).map((s: any) => ({ name: s.name, typeParams: (s?.typeParameters || []).length, abilities: s?.abilities }));
        for (const fn of names) {
          const fnName = String(fn).toLowerCase();
          if (fnName.includes('liquid')) out.candidates.liquidationFns.push(`${name}::${fn}`);
        }
      }
    }
  } catch (e) {
    out.modulesError = String(e);
  }

  // Fetch parameter types for candidate liquidation functions
  try {
    for (const fqn of out.candidates.liquidationFns as string[]) {
      const [module, fn] = fqn.split('::');
      try {
        const nf = await (client as any).getNormalizedMoveFunction({ package: pkg, module, function: fn });
        const params = (nf?.parameters || []).map((p: any) => (typeof p === 'string' ? p : JSON.stringify(p)));
        out.fnParams[`${module}::${fn}`] = params;
      } catch (_) {}
    }
  } catch (e) {
    out.fnParamsError = String(e);
  }

  // Parse param types to infer external module addresses (e.g., storage::Storage, oracle::PriceOracle)
  try {
    const addrHints = new Set<string>();
    for (const [fqn, params] of Object.entries<any>(out.fnParams)) {
      for (const p of params as string[]) {
        if (!p || typeof p !== 'string') continue;
        if (p.includes('"Struct"')) {
          try {
            const obj = JSON.parse(p);
            const st = obj?.Reference?.Struct || obj?.MutableReference?.Struct || obj?.Struct;
            if (st && st.address && st.module && st.name) {
              const modFqn = `${st.address}::${st.module}::${st.name}`;
              if (/::storage::Storage$/.test(modFqn) || /::oracle::PriceOracle$/.test(modFqn) || /::incentive(_v2|_v3)?::Incentive$/.test(modFqn)) {
                addrHints.add(modFqn);
              }
            }
          } catch {}
        }
      }
    }
    out.addrHints = Array.from(addrHints);

    // Query objects for Storage and PriceOracle types (non-generic)
    const discoveredObjs: SharedObj[] = [];
    for (const hint of out.addrHints as string[]) {
      if (/::storage::Storage$/.test(hint) || /::oracle::PriceOracle$/.test(hint)) {
        try {
          const objs = await client.queryObjects({ filter: { StructType: hint }, options: { showOwner: true, showType: true }, limit: 20 });
          for (const o of objs.data || []) {
            const owner = o.owner as any;
            const isShared = owner && (('Shared' in owner) || owner === 'Shared');
            discoveredObjs.push({ id: o.objectId, objectType: o.type || hint, createdBy: undefined });
            if (isShared) out.sharedObjects.push({ id: o.objectId, objectType: o.type || hint });
          }
        } catch {}
      }
    }
    // Deduplicate
    const uniq = new Map<string, SharedObj>();
    for (const s of [...out.sharedObjects, ...discoveredObjs]) uniq.set(s.id, s);
    out.sharedObjects = Array.from(uniq.values());
  } catch (e) {
    out.addrHintsError = String(e);
  }

  // Inspect structs with key ability and probe for objects by struct type (skip in LIGHT mode)
  try {
    if (LIGHT) throw new Error('LIGHT mode: skip struct-based object probing');
    const modulesToProbe = (out.modules as string[]).filter((m) => /storage|pool|oracle|config|manage|lending|logic|incentive/i.test(m));
    for (const m of modulesToProbe) {
      const mod = data[m];
      if (!mod) continue;
      const structs = mod?.structs ?? {};
      const structEntries = Array.isArray(structs) ? structs.map((s: any) => [s.name, s]) : Object.entries<any>(structs);
      for (const [sname, sdef] of structEntries) {
        const abilities: string[] = Array.isArray(sdef?.abilities) ? sdef.abilities : Object.keys(sdef?.abilities || {}).filter((k) => sdef.abilities[k]);
        const hasKey = abilities.some((a) => String(a).toLowerCase() === 'key');
        if (!hasKey) continue;
        const structType = `${pkg}::${m}::${sname}`;
        try {
          const objects = await client.queryObjects({ filter: { StructType: structType }, options: { showOwner: true, showType: true }, limit: 50 });
          for (const o of objects.data || []) {
            const owner = o.owner as any;
            const isShared = owner && (('Shared' in owner) || owner === 'Shared');
            if (isShared) {
              out.sharedObjects.push({ id: o.objectId, objectType: o.type || structType });
              if (looksLikeStorage(o.type || '')) out.candidates.storageTypes.push(o.type || structType);
              if (looksLikeOracle(o.type || '')) out.candidates.oracleTypes.push(o.type || structType);
              if (looksLikePool(o.type || '')) out.candidates.poolTypes.push(o.type || structType);
            }
          }
        } catch (_) {
          // ignore per-struct query errors
        }
      }
    }
  } catch (e) {
    out.structsProbeError = String(e);
  }

  // Shared objects owned by 'Shared' under this package; also collect likely object candidates regardless of owner (skip in LIGHT mode)
  try {
    if (LIGHT) throw new Error('LIGHT mode: skip package object scan');
    const objs = await client.queryObjects({
      filter: { Package: pkg },
      options: { showOwner: true, showType: true },
      limit: 200
    });
    const sharedObjs: SharedObj[] = [];
    const candidates: CandidateObj[] = [];
    for (const o of objs.data || []) {
      const owner = o.owner as any;
      const isShared = owner && (('Shared' in owner) || owner === 'Shared');
      const ownerKind = isShared ? 'Shared' : (typeof owner === 'string' ? owner : (owner && Object.keys(owner)[0]) || 'Unknown');
      const t = o.type || '';
      if (looksLikeStorage(t) || looksLikePool(t) || looksLikeOracle(t)) {
        candidates.push({ id: o.objectId, objectType: t, ownerKind });
      }
      if (isShared) {
        sharedObjs.push({ id: o.objectId, objectType: o.type || '<unknown>' });
        if (looksLikeStorage(t)) out.candidates.storageTypes.push(t);
        if (looksLikeOracle(t)) out.candidates.oracleTypes.push(t);
        if (looksLikePool(t)) out.candidates.poolTypes.push(t);
      }
    }
    out.sharedObjects = sharedObjs;
    out.objectCandidates = candidates;
  } catch (e) {
    out.sharedObjectsError = String(e);
  }

  // Recent txs touching this package: collect events
  try {
    const txs = await client.queryTransactionBlocks({
      filter: { Package: pkg },
      options: { showEvents: true, showObjectChanges: true },
      limit: 100,
      order: 'descending'
    });
    const eventTypes = new Set<string>();
    const coinTypes = new Set<string>();
    const createdShared: SharedObj[] = [];

    for (const tx of txs.data || []) {
      for (const oc of tx.objectChanges || []) {
        if (oc.type === 'created') {
          const owner: any = oc.owner;
          const isShared = owner && (('Shared' in owner) || owner === 'Shared');
          if (isShared) {
            createdShared.push({ id: oc.objectId, objectType: oc.objectType || '<unknown>', createdBy: tx.digest });
            const t = oc.objectType || '';
            if (looksLikeStorage(t)) out.candidates.storageTypes.push(t);
            if (looksLikeOracle(t)) out.candidates.oracleTypes.push(t);
            if (looksLikePool(t)) out.candidates.poolTypes.push(t);
          }
        }
      }
      for (const ev of tx.events || []) {
        if (!ev.type) continue;
        if (typeof ev.type === 'string') {
          const t = ev.type as string;
          if (t.startsWith(pkg)) eventTypes.add(t);
          for (const ct of extractCoinTypesFromEventType(t)) coinTypes.add(ct);
        }
      }
    }
    out.eventTypes = Array.from(eventTypes);
    out.coinTypes = Array.from(coinTypes);
    out.sharedObjects = [...(out.sharedObjects || []), ...createdShared];

    // de-duplicate candidates
    out.candidates.storageTypes = Array.from(new Set(out.candidates.storageTypes));
    out.candidates.oracleTypes = Array.from(new Set(out.candidates.oracleTypes));
    out.candidates.poolTypes = Array.from(new Set(out.candidates.poolTypes));
    out.candidates.liquidationFns = Array.from(new Set(out.candidates.liquidationFns));
  } catch (e) {
    out.txsError = String(e);
  }

  // Query events by specific modules likely to emit liquidation-related events
  try {
    const likelyModules = ['lending', 'incentive', 'incentive_v2', 'incentive_v3', 'logic', 'pool', 'storage'];
    for (const mod of likelyModules) {
      if (!out.modules.includes(mod)) continue;
      const evs = await client.queryEvents({
        query: { MoveEventModule: { package: pkg, module: mod } },
        limit: 50
      });
      for (const ev of evs.data || []) {
        const t = ev.type as string;
        if (t?.startsWith(pkg)) out.eventTypes.push(t);
        for (const ct of extractCoinTypesFromEventType(t || '')) out.coinTypes.push(ct);
      }
    }
    // de-duplicate
    out.eventTypes = Array.from(new Set(out.eventTypes));
    out.coinTypes = Array.from(new Set(out.coinTypes));
  } catch (e) {
    out.moduleEventsError = String(e);
  }

  // Scan create/init functions (on likely modules) to capture created shared objects (skip in LIGHT mode)
  try {
    if (LIGHT) throw new Error('LIGHT mode: skip create/init tx scan');
    const modsLikely = (out.modules as string[]).filter((m) => /storage|pool|oracle|config|manage|lending|logic|incentive/i.test(m));
    for (const mod of modsLikely) {
      const fnNames: string[] = out.functionsByModule[mod] || [];
      const candidates = fnNames.filter((f) => /(create|init|add_pool|create_pool|create_config|register|new_)/i.test(f));
      for (const fn of candidates) {
        let cursor: string | null = null;
        let scanned = 0;
        const MAX = 150;
        do {
          const txs = await client.queryTransactionBlocks({
            filter: { MoveFunction: { package: pkg, module: mod, function: fn } },
            options: { showObjectChanges: true },
            limit: 25,
            order: 'descending',
            cursor: cursor || undefined
          });
          for (const tx of txs.data || []) {
            scanned++;
            for (const oc of tx.objectChanges || []) {
              if (oc.type === 'created') {
                const owner: any = oc.owner;
                const isShared = owner && (('Shared' in owner) || owner === 'Shared');
                if (isShared) {
                  out.sharedObjects.push({ id: oc.objectId, objectType: oc.objectType || '<unknown>', createdBy: tx.digest });
                  const t = oc.objectType || '';
                  if (looksLikeStorage(t)) out.candidates.storageTypes.push(t);
                  if (looksLikeOracle(t)) out.candidates.oracleTypes.push(t);
                  if (looksLikePool(t)) out.candidates.poolTypes.push(t);
                }
              }
            }
          }
          cursor = txs.nextCursor;
          if (!cursor) break;
        } while (scanned < MAX);
      }
    }
    // Deduplicate
    const uniq = new Map<string, SharedObj>();
    for (const s of out.sharedObjects) uniq.set(s.id, s);
    out.sharedObjects = Array.from(uniq.values());
    out.candidates.storageTypes = Array.from(new Set(out.candidates.storageTypes));
    out.candidates.oracleTypes = Array.from(new Set(out.candidates.oracleTypes));
    out.candidates.poolTypes = Array.from(new Set(out.candidates.poolTypes));
  } catch (e) {
    out.createFnScanError = String(e);
  }

  return out;
}

async function main() {
  const results: any[] = [];
  for (const pkg of PACKAGES) {
    const r = await discoverForPackage(pkg);
    results.push(r);
  }
  // Pretty print
  for (const r of results) {
    console.log(`\n=== Package ${r.package} ===`);
    console.log(`Modules: ${r.modules.length}`);
    for (const m of r.modules) {
      const fns = r.functionsByModule[m] || [];
      console.log(`- ${m}: ${fns.length} fns${fns.length ? ' (e.g., ' + fns.slice(0, 6).join(', ') + (fns.length > 6 ? ', ...' : '') + ')' : ''}`);
    }
    console.log(`Shared objects discovered: ${r.sharedObjects.length}`);
    for (const s of r.sharedObjects.slice(0, 10)) {
      console.log(`  * ${s.id} : ${s.objectType}${s.createdBy ? ` (tx ${s.createdBy})` : ''}`);
    }
    console.log(`Object candidates (by type interest, up to 10):`);
    for (const s of (r.objectCandidates || []).slice(0, 10)) {
      console.log(`  * ${s.id} : ${s.objectType} [${s.ownerKind || ''}]`);
    }
    console.log(`Event types (sample up to 10):`);
    for (const t of r.eventTypes.slice(0, 10)) console.log(`  - ${t}`);
    console.log(`Coin types inferred (up to 10):`);
    for (const c of r.coinTypes.slice(0, 10)) console.log(`  - ${c}`);
    console.log(`Candidates:`);
    console.log(`  liquidation fns: ${r.candidates.liquidationFns.join(', ')}`);
    if (r.candidates.liquidationFns.length) {
      console.log('  liquidation fn params:');
      for (const fqn of r.candidates.liquidationFns.slice(0, 8)) {
        const [mod, fn] = fqn.split('::');
        const key = `${mod}::${fn}`;
        const params = r.fnParams?.[key] || [];
        if (params.length) console.log(`    - ${fqn}(${params.join(', ')})`);
      }
    }
    console.log(`  storage types: ${r.candidates.storageTypes.join(', ')}`);
    console.log(`  oracle types: ${r.candidates.oracleTypes.join(', ')}`);
    console.log(`  pool types: ${r.candidates.poolTypes.join(', ')}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

