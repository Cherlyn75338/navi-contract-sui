// Repay/fee sanding simulator: models normalization via multiply/divide by 10
// and computes fee difference for single vs split repayments.

type FeeModel = {
  // fee in normalized units as integer floor of (rate * normalized_amount)
  // e.g., ratePpm = 1000 => 0.1%
  ratePpm: number;
};

function convertAmount(amount: bigint, fromDec: number, toDec: number): bigint {
  let a = amount;
  let d = fromDec;
  while (d !== toDec) {
    if (d < toDec) {
      a = a * 10n;
      d++;
    } else {
      a = a / 10n; // truncation
      d--;
    }
  }
  return a;
}

function feeForRepay(model: FeeModel, repayNative: bigint, nativeDec: number): bigint {
  const normalized = convertAmount(repayNative, nativeDec, 9);
  // fee = floor(rate * normalized / 1e6)
  return (BigInt(model.ratePpm) * normalized) / 1_000_000n;
}

function simulateSingleVsSplit(totalNative: bigint, nativeDec: number, chunks: number, model: FeeModel) {
  const singleFee = feeForRepay(model, totalNative, nativeDec);
  const perChunk = totalNative / BigInt(chunks);
  const remainder = totalNative - perChunk * BigInt(chunks);
  let splitFee = 0n;
  for (let i = 0; i < chunks; i++) {
    const amt = perChunk + (i === 0 ? remainder : 0n);
    splitFee += feeForRepay(model, amt, nativeDec);
  }
  return { singleFee, splitFee };
}

function runRepaySandingDemo() {
  const nativeDec = 18;
  const ratePpm = 1000; // 0.1% illustrative
  const model: FeeModel = { ratePpm };

  const totals = [
    10n ** 17n, // 0.1 token
    10n ** 18n, // 1 token
    5n * 10n ** 18n, // 5 tokens
  ];
  const chunkSizes = [2, 4, 10, 100, 1000];

  for (const total of totals) {
    for (const chunks of chunkSizes) {
      const { singleFee, splitFee } = simulateSingleVsSplit(total, nativeDec, chunks, model);
      console.log(
        JSON.stringify(
          {
            totalNative: total.toString(),
            chunks,
            singleFee: singleFee.toString(),
            splitFee: splitFee.toString(),
            delta: (singleFee - splitFee).toString(),
          },
          null,
          2,
        ),
      );
    }
  }
}

runRepaySandingDemo();

