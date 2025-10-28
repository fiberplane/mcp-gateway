/**
 * Efficient array comparison utilities
 *
 * These utilities provide performant array comparisons without the overhead
 * of JSON.stringify, which creates temporary strings and is O(n log n) due to sorting.
 */

/**
 * Check if two arrays contain the same elements (order-independent)
 * Uses Set for O(n) time complexity instead of O(n log n) sorting
 *
 * @example
 * arraysEqualSet(['a', 'b'], ['b', 'a']) // true
 * arraysEqualSet(['a', 'b'], ['a', 'c']) // false
 * arraysEqualSet([], []) // true
 */
export function arraysEqualSet<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;

  const setA = new Set(a);
  const setB = new Set(b);

  if (setA.size !== setB.size) return false;

  for (const item of setA) {
    if (!setB.has(item)) return false;
  }

  return true;
}

/**
 * Check if two arrays are strictly equal (order-dependent)
 * Faster than arraysEqualSet when order matters
 *
 * @example
 * arraysEqualStrict(['a', 'b'], ['a', 'b']) // true
 * arraysEqualStrict(['a', 'b'], ['b', 'a']) // false
 */
export function arraysEqualStrict<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}
