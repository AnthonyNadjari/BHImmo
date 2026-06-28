/**
 * Deterministic pseudo-random number generation.
 *
 * The pipeline must produce stable output across CI runs (the spec requires
 * "deterministic outputs where possible"). We therefore avoid `Math.random()`
 * entirely and seed every synthetic value from a stable string (usually a
 * property id), so the same input always yields the same number.
 */

/** Fast, well-distributed 32-bit string hash (FNV-1a variant). */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Force unsigned 32-bit.
  return h >>> 0;
}

/** Mulberry32 PRNG — tiny, fast, good enough for synthetic data. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A small deterministic random helper bound to a seed string. Every method is
 * pure with respect to the call sequence, so two runs over the same seed yield
 * identical streams.
 */
export class SeededRandom {
  private next: () => number;

  constructor(seed: string | number) {
    const numericSeed = typeof seed === "number" ? seed : hashString(seed);
    this.next = mulberry32(numericSeed);
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick one element from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  /**
   * Approximate normal distribution via the central-limit trick. Returns a
   * value centered on `mean` with the given standard deviation.
   */
  gaussian(mean: number, stdDev: number): number {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += this.next();
    // sum of 6 uniforms ~ N(3, 0.5); normalize to N(0,1).
    const z = (sum - 3) / Math.sqrt(0.5);
    return mean + z * stdDev;
  }
}
