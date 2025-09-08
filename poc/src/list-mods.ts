import { SuiClient } from '@mysten/sui.js/client';

const PACKAGES = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83'
];

(async () => {
  const c = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });
  for (const p of PACKAGES) {
    try {
      const mods = await c.getNormalizedMoveModulesByPackage({ package: p });
      console.log('Package', p, 'modules:', Object.keys(mods));
    } catch (e) {
      console.error('Error reading package', p, e);
    }
  }
})();

