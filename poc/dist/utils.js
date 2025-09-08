import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { FULLNODE } from './config.js';
export const provider = new SuiClient({ url: FULLNODE || getFullnodeUrl('mainnet') });
export function normalizeValue(amountCoins, coinDecimals, priceInt, priceDecimals, target = 18) {
    if (coinDecimals > target) {
        // downscale amount to target
        const s = BigInt(coinDecimals - target);
        amountCoins = amountCoins / (10n ** s);
    }
    else if (coinDecimals < target) {
        const s = BigInt(target - coinDecimals);
        amountCoins = amountCoins * (10n ** s);
    }
    if (priceDecimals > target) {
        const s = BigInt(priceDecimals - target);
        priceInt = priceInt / (10n ** s);
    }
    else if (priceDecimals < target) {
        const s = BigInt(target - priceDecimals);
        priceInt = priceInt * (10n ** s);
    }
    const valueRaw = amountCoins * priceInt;
    return { valueRaw, scaleExp: 2 * target };
}
export function ratioDelta(a, b) {
    if (b === 0n)
        return a === 0n ? 0 : Infinity;
    const diff = a > b ? a - b : b - a;
    // convert to floating ratio
    return Number(diff) / Number(b);
}
export async function getCoinDecimals(coinType) {
    const meta = await provider.getCoinMetadata({ coinType });
    if (!meta)
        throw new Error(`No coin metadata for ${coinType}`);
    return meta.decimals;
}
export function bigintFromU256Return(ret) {
    // Sui devInspect returns Move values as strings for big ints
    if (typeof ret === 'string')
        return BigInt(ret);
    if (typeof ret === 'number')
        return BigInt(ret);
    if (ret && typeof ret === 'object' && 'u256' in ret)
        return BigInt(ret.u256);
    throw new Error('Unsupported u256 return shape');
}
//# sourceMappingURL=utils.js.map