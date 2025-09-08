import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { FULLNODE, PACKAGES } from './config.js';

const provider = new SuiClient({ url: FULLNODE || getFullnodeUrl('mainnet') });

async function main() {
  for (const pkg of PACKAGES) {
    try {
      const modules: any = await (provider as any).getNormalizedMoveModulesByPackage({ package: pkg });
      const data = modules?.data ?? modules ?? {};
      const names: string[] = [];
      if (!Array.isArray(data) && typeof data === 'object') {
        for (const name of Object.keys(data)) names.push(name);
      } else if (Array.isArray(data)) {
        for (const m of data) names.push(m.module?.name ?? '<unknown>');
      }
      console.log(`Package ${pkg} has ${names.length} modules`);
      for (const name of names) {
        console.log(`- module: ${name}`);
        const mod = (data as any)[name];
        const fnMap = mod?.exposedFunctions ?? {};
        const fns = Object.keys(fnMap);
        if (fns.length) for (const fn of fns) console.log(`  * fn ${fn}`);
      }
    } catch (e) {
      console.error(`Failed to fetch modules for ${pkg}: ${String((e as Error).message || e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

