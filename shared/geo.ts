/** Geospatial helpers (all distances in meters, coordinates in WGS84). */

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Round to a fixed number of decimals (default 0). */
export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Mean of a numeric array (0 for empty input). */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Median of a numeric array (0 for empty input). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Population standard deviation. */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/**
 * Coefficient of variation (std/mean) — a unitless measure of relative
 * dispersion, used as our volatility proxy. Returns 0 when the mean is 0.
 */
export function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return stdDev(values) / m;
}

/** Value at the `q` quantile (0–1) of a numeric array (0 for empty input). */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/**
 * Uniform lat/lng grid index for fast radius queries over large point sets
 * (220k street trees, 150k DVF sales). Cells are ~550 m tall.
 */
export class PointIndex<T extends { lat: number; lng: number }> {
  private static readonly CELL = 0.005;
  private readonly cells = new Map<string, T[]>();
  readonly size: number;

  constructor(points: T[]) {
    for (const p of points) {
      const k = this.key(Math.floor(p.lat / PointIndex.CELL), Math.floor(p.lng / PointIndex.CELL));
      (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(p);
    }
    this.size = points.length;
  }

  private key(i: number, j: number): string {
    return `${i}:${j}`;
  }

  /** Points within `radius` m, each with its distance, nearest first. */
  within(lat: number, lng: number, radius: number): Array<{ p: T; d: number }> {
    const c = PointIndex.CELL;
    const di = Math.ceil(radius / 111_000 / c);
    const dj = Math.ceil(radius / (111_000 * Math.cos((lat * Math.PI) / 180)) / c);
    const ci = Math.floor(lat / c);
    const cj = Math.floor(lng / c);
    const out: Array<{ p: T; d: number }> = [];
    for (let i = ci - di; i <= ci + di; i++) {
      for (let j = cj - dj; j <= cj + dj; j++) {
        for (const p of this.cells.get(this.key(i, j)) ?? []) {
          const d = haversineMeters(lat, lng, p.lat, p.lng);
          if (d <= radius) out.push({ p, d });
        }
      }
    }
    return out.sort((a, b) => a.d - b.d);
  }

  count(lat: number, lng: number, radius: number): number {
    return this.within(lat, lng, radius).length;
  }
}

type Ring = Array<[number, number]>;

/** Ray-casting point-in-polygon on GeoJSON [lng, lat] rings (holes respected). */
export function pointInPolygon(lat: number, lng: number, geometry: { type: string; coordinates: unknown }): boolean {
  const inRing = (ring: Ring): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const inPoly = (rings: Ring[]): boolean => inRing(rings[0]!) && !rings.slice(1).some(inRing);
  if (geometry.type === "Polygon") return inPoly(geometry.coordinates as Ring[]);
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as Ring[][]).some(inPoly);
  return false;
}
