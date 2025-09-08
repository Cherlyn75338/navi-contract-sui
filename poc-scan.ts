import { SuiClient, getFullnodeUrl } from '@mysten/sui.js';
import type { SuiMoveNormalizedModule } from '@mysten/sui.js';

const PACKAGES = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83',
];

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

function getPoolStructName(pkg: string) {
  return `${pkg}::pool::Pool`;
}

async function fetchNormalizedModules(pkg: string) {
  return client.getNormalizedMoveModulesByPackage({ package: pkg });
}

function moduleHasPoolArg(mod: SuiMoveNormalizedModule): boolean {
  for (const [, func] of Object.entries(mod.exposedFunctions ?? {})) {
    if (!func.isEntry) continue;
    if (!func.typeParameters || func.typeParameters.length === 0) continue;
    for (const param of func.parameters) {
      if (typeof param === 'object' && 'MutableReference' in param) {
        const mr: any = (param as any).MutableReference;
        if (mr?.Struct?.module === 'pool' && mr?.Struct?.name === 'Pool') return true;
      }
    }
  }
  return false;
}

async function main() {
  const results: any[] = [];
  for (const pkg of PACKAGES) {
    const modules = await fetchNormalizedModules(pkg);
    const poolArgEntries: string[] = [];
    for (const [name, mod] of Object.entries(modules)) {
      if (moduleHasPoolArg(mod)) poolArgEntries.push(name);
    }
    results.push({ pkg, poolArgEntries });
  }

  console.log('Entry modules that accept &mut pool::Pool<T>:', JSON.stringify(results, null, 2));

  // Simple heuristic: try to list dynamic fields of plausible storage object(s) is out of scope without specific IDs.
  // Print reminder for manual follow-up to enumerate Pool<T> objects via indexers.
  console.log('Next: enumerate on-chain Pool<T> objects via indexer or by known object IDs.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

