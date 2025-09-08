import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { FULLNODE, PACKAGES } from './config.js';

const provider = new SuiClient({ url: FULLNODE || getFullnodeUrl('mainnet') });

async function main() {
  for (const pkg of PACKAGES) {
    try {
      const modules: any = await (provider as any).getNormalizedMoveModulesByPackage({ package: pkg });
      if (!modules) {
        console.log(`Package ${pkg}: no modules response`);
        continue;
      }
      if (Array.isArray(modules)) {
        console.log(`Package ${pkg} has ${modules.length} modules`);
        for (const m of modules) {
          const name = m.module?.name ?? '<unknown>';
          console.log(`- module: ${name}`);
          const fns = m.module?.exposedFunctions || [];
          for (const f of fns) {
            console.log(`  * fn ${f.name}`);
          }
        }
      } else if (modules.data) {
        console.log(`Package ${pkg} has ${modules.data.length} modules`);
        for (const m of modules.data) {
          const name = m.module?.name ?? '<unknown>';
          console.log(`- module: ${name}`);
          const fns = m.module?.exposedFunctions || [];
          for (const f of fns) {
            console.log(`  * fn ${f.name}`);
          }
        }
      } else {
        console.dir(modules, { depth: 4 });
      }
    } catch (e) {
      console.error(`Failed to fetch modules for ${pkg}`);
      console.dir(e, { depth: 5 });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

