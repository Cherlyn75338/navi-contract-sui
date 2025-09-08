import { JsonRpcProvider, Connection } from '@mysten/sui.js';
import { FULLNODE, PACKAGES } from './config.js';

const provider = new JsonRpcProvider(new Connection({ fullnode: FULLNODE }));

async function main() {
  for (const pkg of PACKAGES) {
    try {
      const modules = await provider.getNormalizedMoveModulesByPackage({ package: pkg });
      console.log(`Package ${pkg} has ${modules.length} modules`);
      for (const m of modules) {
        const name = m.module.name;
        console.log(`- module: ${name}`);
        const fns = m.module.exposedFunctions || [];
        for (const f of fns) {
          console.log(`  * fn ${f.name}(${f.parameters?.map((p: any) => p?.Type || JSON.stringify(p)).join(',') || ''})`);
        }
      }
    } catch (e) {
      console.error(`Failed to fetch modules for ${pkg}:`, (e as Error).message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

