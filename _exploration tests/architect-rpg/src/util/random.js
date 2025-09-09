// Small seeded PRNG so “hand jitter” is repeatable across frames.
export function makeRng(seed = 1337) {
  let s = seed >>> 0;
  return function rand() {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17; s >>>= 0;
    s ^= s << 5;  s >>>= 0;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}