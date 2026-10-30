export interface ScaleOptions {
  /** Each value is rounded to a multiple of this (e.g. 100 for rupees, 5 for guests). */
  step: number;
  /** Smallest value any item may get after rounding. */
  min?: number;
  /** Keep the largest item at zero or more after it takes the remainder (default true). */
  floorAtZero?: boolean;
}

/**
 * Scales values in proportion so they add up to `total`, rounding each to
 * `step` and putting any rounding remainder in the largest item (the first,
 * if several tie). The caller makes sure the values sum to more than zero.
 */
export function scaleToTotal(values: readonly number[], total: number, options: ScaleOptions): number[] {
  const { step, min, floorAtZero = true } = options;
  const sum = values.reduce((acc, v) => acc + v, 0);
  const scaled = values.map((v) => {
    const rounded = Math.round(((v / sum) * total) / step) * step;
    return min === undefined ? rounded : Math.max(min, rounded);
  });
  if (scaled.length === 0) return scaled;
  const diff = total - scaled.reduce((acc, v) => acc + v, 0);
  let largest = 0;
  scaled.forEach((v, i) => {
    if (v > scaled[largest]) largest = i;
  });
  const topped = scaled[largest] + diff;
  scaled[largest] = floorAtZero ? Math.max(0, topped) : topped;
  return scaled;
}
