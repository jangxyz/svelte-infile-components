/**
 * Check if object has property of type 'number'
 */
export function hasNumberProperty<T extends object, K extends string>(
  obj: T,
  property: K,
): obj is T & { [P in K]: number } {
  return property in obj && typeof obj[property as any] === 'number';
}
