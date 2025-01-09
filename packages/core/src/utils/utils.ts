export class UnreachableError extends Error {}

export function unreachable(msg = 'unreachable case'): never {
  throw new UnreachableError(msg);
}

export function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null;
}
