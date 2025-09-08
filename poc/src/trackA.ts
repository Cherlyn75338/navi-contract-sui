import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const PKGS = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83',
];

const TARGET_MOD_SUBSTRINGS = [
  'lending',
  'logic',
  'storage',
  'validation',
  'pool',
  'flash_loan',
  'incentive',
  'incentive_v2',
  'incentive_v3',
];

type AnyRecord = Record<string, any>;

async function main() {
  const rpcUrl = process.env.SUI_RPC_URL || getFullnodeUrl('mainnet');
  const client = new SuiClient({ url: rpcUrl });

  for (const pkg of PKGS) {
    try {
      const modules: AnyRecord = await client.getNormalizedMoveModulesByPackage({ package: pkg });
      const entries = Object.entries(modules);
      console.log(`\n=== Package ${pkg} | modules: ${entries.length} ===`);

      for (const [modName, mod] of entries) {
        const consider = TARGET_MOD_SUBSTRINGS.some((s) => modName.includes(s));
        if (!consider) continue;

        console.log(`\n-- Module ${pkg}::${modName}`);

        // Structs of interest
        const structEntries = Object.entries((mod as AnyRecord).structs ?? {}) as [string, AnyRecord][];
        for (const [sname, sdef] of structEntries) {
          if (['ReserveData', 'Storage', 'Pool', 'Receipt', 'AdminCap'].some((x) => sname.includes(x))) {
            console.log(`struct ${sname}`);
            for (const f of (sdef as AnyRecord).fields ?? []) {
              console.log(`  - ${f.name}: ${JSON.stringify(f.type)}`);
            }
          }
        }

        // Functions of interest
        const fns = (mod as AnyRecord).functions ?? (mod as AnyRecord).exposedFunctions ?? {};
        const funcEntries = Object.entries(fns) as [string, AnyRecord][];
        const interesting = funcEntries.filter(([fname]) =>
          ['deposit', 'withdraw', 'borrow', 'repay', 'entry_', 'flash', 'loan', 'create_pool', 'validate', 'execute'].some((k) => fname.includes(k))
        );
        for (const [fname, fdef] of interesting) {
          const isEntry = (fdef as AnyRecord).isEntry ?? (fdef as AnyRecord).is_entry;
          const visibility = (fdef as AnyRecord).visibility ?? 'unknown';
          const generics = (fdef as AnyRecord).typeParameters ?? (fdef as AnyRecord).generic_type_params ?? [];
          const params = (fdef as AnyRecord).parameters ?? [];
          const returns = (fdef as AnyRecord).return ?? [];
          console.log(`fn ${fname}${isEntry ? ' [entry]' : ''} vis=${visibility}`);
          console.log(`  generics: ${generics?.length ?? 0}`);
          console.log(`  params: ${JSON.stringify(params)}`);
          console.log(`  returns: ${JSON.stringify(returns)}`);
        }
      }
    } catch (e) {
      console.error(`Failed to fetch/parse package ${pkg}:`, e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

