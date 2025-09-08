import { SuiGraphQLClient } from '@mysten/sui.js/graphql';

const pkg = process.env.PKG || '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca';
const type = `${pkg}::flash_loan::Config`;
const url = process.env.SUI_GRAPHQL_URL || 'https://sui-mainnet.mystenlabs.com/graphql';

async function main() {
  const client = new SuiGraphQLClient({ url });
  const query = /* GraphQL */ `
    query FindConfig($type: String!) {
      objects(filter: { type: $type }, first: 10) { nodes { objectId owner type } }
    }
  `;
  const res: any = await client.query({ query, variables: { type } });
  console.log(JSON.stringify(res.data.objects.nodes, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
