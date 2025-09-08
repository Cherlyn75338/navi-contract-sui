import { JsonRpcProvider, Connection, SuiObjectRef } from '@mysten/sui.js';
import { FULLNODE } from './config.js';

export const provider = new JsonRpcProvider(new Connection({ fullnode: FULLNODE }));

export type NormalizedValue = {
  valueRaw: bigint; // amount * price at target^2 scale
  scaleExp: number; // exponent for the scale (2*target)
};

export function normalizeValue(
  amountCoins: bigint,
  coinDecimals: number,
  priceInt: bigint,
  priceDecimals: number,
  target: number = 18
): NormalizedValue {
  if (coinDecimals > target) {
    // downscale amount to target
    const s = BigInt(coinDecimals - target);
    amountCoins = amountCoins / (10n ** s);
  } else if (coinDecimals < target) {
    const s = BigInt(target - coinDecimals);
    amountCoins = amountCoins * (10n ** s);
  }
  if (priceDecimals > target) {
    const s = BigInt(priceDecimals - target);
    priceInt = priceInt / (10n ** s);
  } else if (priceDecimals < target) {
    const s = BigInt(target - priceDecimals);
    priceInt = priceInt * (10n ** s);
  }
  const valueRaw = amountCoins * priceInt;
  return { valueRaw, scaleExp: 2 * target };
}

export function ratioDelta(a: bigint, b: bigint): number {
  if (b === 0n) return a === 0n ? 0 : Infinity;
  const diff = a > b ? a - b : b - a;
  // convert to floating ratio
  return Number(diff) / Number(b);
}

export async function getCoinDecimals(coinType: string): Promise<number> {
  const meta = await provider.getCoinMetadata({ coinType });
  if (!meta) throw new Error(`No coin metadata for ${coinType}`);
  return meta.decimals;
}

export function bigintFromU256Return(ret: any): bigint {
  // Sui devInspect returns Move values as strings for big ints
  if (typeof ret === 'string') return BigInt(ret);
  if (typeof ret === 'number') return BigInt(ret);
  if (ret && typeof ret === 'object' && 'u256' in ret) return BigInt(ret.u256);
  throw new Error('Unsupported u256 return shape');
}

