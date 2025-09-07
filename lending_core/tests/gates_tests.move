#[test_only]
module lending_core::gates_tests {
    use 0x2::tx_context;
    use 0x2::object;
    use lending_core::storage;
    use 0x1::vector;

    #[test]
    fun test_when_not_paused_allows() {
        let mut tctx = tx_context::dummy();
        let st = storage::Storage{
            id: object::new(&mut tctx),
            version: 1,
            paused: false,
            reserves: 0x2::table::new<u8, storage::ReserveData>(&mut tctx),
            reserves_count: 0,
            users: vector::empty<address>(),
            user_info: 0x2::table::new<address, storage::UserInfo>(&mut tctx),
        };
        storage::when_not_paused(&st);
    }

    #[test, expected_failure]
    fun test_when_not_paused_rejects_paused() {
        let mut tctx = tx_context::dummy();
        let st = storage::Storage{
            id: object::new(&mut tctx),
            version: 1,
            paused: true,
            reserves: 0x2::table::new<u8, storage::ReserveData>(&mut tctx),
            reserves_count: 0,
            users: vector::empty<address>(),
            user_info: 0x2::table::new<address, storage::UserInfo>(&mut tctx),
        };
        storage::when_not_paused(&st);
    }
}

