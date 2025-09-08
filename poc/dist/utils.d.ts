import { SuiClient } from '@mysten/sui.js/client';
export declare const provider: SuiClient;
export type NormalizedValue = {
    valueRaw: bigint;
    scaleExp: number;
};
export declare function normalizeValue(amountCoins: bigint, coinDecimals: number, priceInt: bigint, priceDecimals: number, target?: number): NormalizedValue;
export declare function ratioDelta(a: bigint, b: bigint): number;
export declare function getCoinDecimals(coinType: string): Promise<number>;
export declare function bigintFromU256Return(ret: any): bigint;
//# sourceMappingURL=utils.d.ts.map