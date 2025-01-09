/**
 * Check if object has property of type 'number'
 */
export function hasNumberProperty<T extends object, K extends string>(
  obj: T,
  property: K,
): obj is T & { [P in K]: number } {
  return (
    property in obj && typeof obj[property as unknown as keyof T] === 'number'
  );
}

export function _summary(code: string | undefined | null, length = 100) {
  if (!code) return code;
  if (!Number.isFinite(length) || length <= 0) return code;
  if (code.length < length * 2) return code;

  return code.slice(0, length) + '...' + code.slice(-length);
}
