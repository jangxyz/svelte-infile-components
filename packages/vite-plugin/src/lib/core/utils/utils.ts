export class UnreachableError extends Error {}

export function unreachable(msg = 'unreachable case'): never {
  throw new UnreachableError(msg);
}
