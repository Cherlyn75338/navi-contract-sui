import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const PACKAGES = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83',
];

async function main() {
  for (const pkg of PACKAGES) {
    try {
      const mods = await client.getNormalizedMoveModulesByPackage({ package: pkg });
      const names = Object.keys(mods);
      const lending = mods['lending'];
      const flash = mods['flash_loan'];
      console.log('PACKAGE', pkg);
      console.log(' modules:', names.join(','));
      if (lending) {
        const f = lending.exposedFunctions || {};
        const l1 = f['flash_loan_with_ctx'];
        const l2 = f['flash_repay_with_ctx'];
        console.log(' lending::flash_loan_with_ctx ->', l1 ? `${l1.visibility} entry:${l1.isEntry}` : 'missing');
        console.log(' lending::flash_repay_with_ctx ->', l2 ? `${l2.visibility} entry:${l2.isEntry}` : 'missing');
      } else {
        console.log(' lending module missing');
      }
      if (flash) {
        const f = flash.exposedFunctions || {};
        const repay = f['repay'];
        const structs = flash.structs || {};
        const receipt = structs['Receipt'];
        console.log(' flash_loan::repay ->', repay ? `${repay.visibility} entry:${repay.isEntry}` : 'missing');
        console.log(' flash_loan::Receipt abilities ->', receipt?.abilities ?? 'missing');
      } else {
        console.log(' flash_loan module missing');
      }
      console.log('');
    } catch (e) {
      console.error('Error inspecting', pkg, e);
    }
  }
}

main();

