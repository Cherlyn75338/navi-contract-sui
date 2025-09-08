export const PACKAGES = [
  '0x81c408448d0d57b3e371ea94de1d40bf852784d3e225de1e74acab3e8395c18f',
  '0x66aa3335901ce7e04b85ed6597ee42d4b479f7110bf98e8ebd474fa32a0027e1',
  '0xc2d49bf5e75d2258ee5563efa527feb6155de7ac6f6bf025a23ee88cd12d5a83',
  // Inferred from function parameter types
  '0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca',
  '0xca441b44943c16be0e6e23c5a955bb971537ea3289ae8016fbf33fffe1fd210f'
];

export type Placeholders = {
  storageObjectId: string;
  poolObjectId: string;
  oracleObjectId: string;
  logicModule: string; // e.g., 'logic'
  lendingModule: string; // e.g., 'lending'
  oracleModule: string; // e.g., 'oracle'
  storageModule: string; // e.g., 'storage'
  // function names
  fnUserHealthFactor: string; // 'user_health_factor'
  fnUserCollateralValue: string; // 'user_collateral_value'
  fnUserLoanValue: string; // 'user_loan_value'
  fnGetUserBalance: string; // 'get_user_balance'
  fnGetIndex: string; // 'get_index'
  fnGetPrice: string; // 'get_price' or provider-specific
  fnLiquidate: string; // 'liquidate' or 'execute_liquidation'
};

export const PLACEHOLDERS: Placeholders = {
  storageObjectId: '0x<fill-storage-object-id>',
  poolObjectId: '0x<fill-pool-object-id>',
  oracleObjectId: '0x<fill-oracle-object-id>',
  logicModule: 'logic',
  lendingModule: 'lending',
  oracleModule: 'oracle',
  storageModule: 'storage',
  fnUserHealthFactor: 'user_health_factor',
  fnUserCollateralValue: 'user_collateral_value',
  fnUserLoanValue: 'user_loan_value',
  fnGetUserBalance: 'get_user_balance',
  fnGetIndex: 'get_index',
  fnGetPrice: 'get_price',
  fnLiquidate: 'liquidate'
};

export const FULLNODE = process.env.SUI_RPC || 'https://fullnode.mainnet.sui.io:443';

export type AssetConfig = {
  name: string;
  coinType: string; // fully qualified, e.g., '0x2::coin::Coin<...>'
};

export const ASSETS: AssetConfig[] = [
  { name: 'USDC_like', coinType: '0x2::coin::Coin<0x<usdc-coin-type>>' },
  { name: 'SUI_like', coinType: '0x2::sui::SUI' }
];

export const BORROWERS: string[] = [
  '0x<borrower-1>',
  '0x<borrower-2>'
];

