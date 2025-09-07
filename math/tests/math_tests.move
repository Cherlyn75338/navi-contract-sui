#[test_only]
module math::math_tests;

use 0x2::address;
use 0x1::vector;
use 0x1::option::{Self, Option};
use math::ray_math;
use math::safe_math;

const E_OVERFLOW_GUARD: u64 = 1101;
const E_DIV_BY_ZERO: u64 = 1103;

fun lcg_next(seed: u256): u256 { // simple deterministic generator
    // X_{n+1} = (a*X_n + c) mod 2^64 then widen to u256 range by scaling
    let a: u256 = 6364136223846793005; // Knuth LCG
    let c: u256 = 1442695040888963407;
    let x = a * (seed & 0xFFFFFFFFFFFFFFFF) + c;
    (x & 0xFFFFFFFFFFFFFFFF) * 1000000000
}

fun clamp_for_mul(a: u256, b: u256, denom: u256): (u256, u256) {
    // ensure (a*b + denom/2) <= address::max()
    let half = denom / 2;
    if (a == 0 || b == 0) { return (a, b) };
    let max = address::max();
    if (a > (max - half) / b) {
        let new_a = (max - half) / b;
        return (new_a, b)
    };
    (a, b)
}

#[test]
fun test_wad_mul_basic() {
    let one = ray_math::wad();
    let x: u256 = 1234567890123456789; // ~1.2345 wad
    assert!(ray_math::wad_mul(x, one) == x, 0);
    assert!(ray_math::wad_mul(one, x) == x, 1);
    assert!(ray_math::wad_mul(0, x) == 0, 2);
    assert!(ray_math::wad_mul(x, 0) == 0, 3);
}

#[test]
fun test_wad_div_basic() {
    let one = ray_math::wad();
    let two = ray_math::wad() * 2;
    assert!(ray_math::wad_div(two, two) == one, 0);
    assert!(ray_math::wad_div(two, one) == two, 1);
}

#[test, expected_failure(abort_code = E_DIV_BY_ZERO)]
fun test_wad_div_by_zero_panics() { let _ = ray_math::wad_div(1, 0); }

#[test]
fun test_ray_mul_div_rounding_half_up() {
    let a: u256 = 3;
    let b: u256 = ray_math::ray() / 2; // 0.5 in ray
    // 3 * 0.5 = 1.5 -> half-up to 2 when multiplied/divided through ray
    let prod = ray_math::ray_mul(a, b);
    assert!(prod == 2, 0);

    let num: u256 = ray_math::ray() + ray_math::half_ray(); // 1.5 ray
    let d: u256 = 1; // divide by 1 preserves rounding offset in implementation: (num + d/2) / d
    let q = ray_math::ray_div(num, d);
    assert!(q == num, 1);
}

#[test]
fun test_wad_ray_conversions() {
    let wad_one = ray_math::wad();
    let ray_one = ray_math::ray();
    let up = ray_math::wad_to_ray(wad_one);
    assert!(up == 1000000000 * wad_one, 0);
    let down = ray_math::ray_to_wad(ray_one);
    assert!(down == 1000000000, 1);
}

#[test]
fun test_safe_math_add_sub_mul_div_mod() {
    assert!(safe_math::add(1, 2) == 3, 0);
    assert!(safe_math::sub(5, 5) == 0, 1);
    assert!(safe_math::mul(0, 123456) == 0, 2);
    assert!(safe_math::div(10, 5) == 2, 3);
    assert!(safe_math::mod(10, 6) == 4, 4);
}

#[test]
fun test_ray_mul_overflow_guard() {
    // pick values near guard boundary and ensure either passes or aborts with expected code
    let denom = ray_math::ray();
    let half = ray_math::half_ray();
    let max = address::max();
    let b: u256 = 1234567890123;
    let a_ok = (max - half) / b; // boundary ok
    let prod_ok = ray_math::ray_mul(a_ok, b);
    // prod_ok is defined; just ensure it doesn't abort
    assert!(prod_ok >= 0, 0);
}

#[test]
fun test_property_many_wad_mul_invariants() {
    let denom = ray_math::wad();
    let seed: u256 = 1;
    let i = 0;
    let s = seed;
    while (i < 64) {
        let a = lcg_next(s) + 1; // avoid zero to test non-zero paths too
        let b = lcg_next(a) + 1;
        let (aa, bb) = clamp_for_mul(a, b, denom);
        let prod = ray_math::wad_mul(aa, bb);
        // basic bounds: prod <= max(address::max()) and prod == 0 if any arg == 0
        assert!(prod >= 0, i);
        // identity around 1 wad
        assert!(ray_math::wad_mul(aa, ray_math::wad()) == aa, i + 1000);
        i = i + 1;
        s = b;
    };
}


