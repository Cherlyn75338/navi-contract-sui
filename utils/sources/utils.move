module 0xd899cf7d2b5db716bd2cf55599fb0d5ee38a3061e7b6bb6eebf73fa5bc4c81ca::utils {
    public fun split_coin<T0>(arg0: 0x2::coin::Coin<T0>, arg1: u64, arg2: &mut 0x2::tx_context::TxContext) : 0x2::coin::Coin<T0> {
        assert!(arg1 > 0, 46000);
        assert!(0x2::coin::value<T0>(&arg0) >= arg1, 46001);
        let mut coin_rest = arg0;
        let coin_out = 0x2::coin::split<T0>(&mut coin_rest, arg1, arg2);
        0x2::transfer::public_transfer<0x2::coin::Coin<T0>>(coin_rest, 0x2::tx_context::sender(arg2));
        coin_out
    }
    
    public fun split_coin_to_balance<T0>(arg0: 0x2::coin::Coin<T0>, arg1: u64, arg2: &mut 0x2::tx_context::TxContext) : 0x2::balance::Balance<T0> {
        0x2::coin::into_balance<T0>(split_coin<T0>(arg0, arg1, arg2))
    }
    
    // decompiled from Move bytecode v6
}
