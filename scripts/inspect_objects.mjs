import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

// Paste IDs here from the user's message
const IDS = [
  '0x3672b2bf471a60c30a03325f104f92fb195c9d337ba58072dce764fe2aa5e2dc',
  '0xa3582097b4c57630046c0c49a88bfc6b202a3ec0a9db5597c31765f7563755a8',
  '0x699d455ab8c5e02075b4345ea1f91be55bf46064ae6026cc2528e701ce3ac135',
  '0xe05dafb5133bcffb8d59f4e12465dc0e9faeaa05e3e342a08fe135800e3e4407',
  '0x0000000000000000000000000000000000000000000000000000000000000006',
  '0x0df4f02d0e210169cb6d5aabd03c3058328c06f2c4dbb0804faa041159c78443',
  '0xf1cf0e81048df168ebeb1b8030fad24b3e0b53ae827c25053fff0779c1445b6f',
  '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe',
  '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
  '0xb8d7d9e66a60c239e7a60110efcf8de6c705580ed924d0dde141f4a0e2c90105',
  '0x639b5e433da31739e800cd085f356e64cae222966d0f1b11bd9dc76b322ff58b',
];

async function main() {
  for (const id of IDS) {
    try {
      const o = await client.getObject({ id, options: { showType: true, showOwner: true, showContent: true } });
      const data = o.data;
      console.log('ID', id);
      console.log('  type:', data?.type);
      console.log('  owner:', data?.owner?.Shared ? 'shared' : JSON.stringify(data?.owner));
      console.log('');
    } catch (e) {
      console.log('ID', id, 'error', e.message);
    }
  }
}

main();